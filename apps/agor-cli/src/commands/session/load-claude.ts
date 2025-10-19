/**
 * `agor session load-claude <session-id>` - Load Claude Code session into Agor
 *
 * Imports a Claude Code session by parsing the transcript file and creating
 * a corresponding Agor session with tasks.
 */

import { createClient, isDaemonRunning } from '@agor/core/api';
import {
  extractTasksFromMessages,
  filterConversationMessages,
  loadClaudeSession,
  transcriptsToMessages,
} from '@agor/core/claude';
import { getDaemonUrl } from '@agor/core/config';
import { generateId } from '@agor/core/db';
import type { Session, SessionID } from '@agor/core/types';
import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';

export default class SessionLoadClaude extends Command {
  static description = 'Load a local Claude Code session into Agor';

  static examples = [
    '<%= config.bin %> <%= command.id %> <session-id>',
    '<%= config.bin %> <%= command.id %> 34e94925-f4cc-4685-8869-83c77062ad14',
    '<%= config.bin %> <%= command.id %> <session-id> --board experiments',
  ];

  static args = {
    sessionId: Args.string({
      description: 'Claude Code session ID to load',
      required: true,
    }),
  };

  static flags = {
    board: Flags.string({
      char: 'b',
      description: 'Board to add session to (name or ID)',
    }),
    'project-dir': Flags.string({
      description: 'Project directory (defaults to current directory)',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SessionLoadClaude);

    // Check if daemon is running
    const daemonUrl = await getDaemonUrl();
    const running = await isDaemonRunning(daemonUrl);

    if (!running) {
      this.error(
        `Daemon not running. Start it with: ${chalk.cyan('cd apps/agor-daemon && pnpm dev')}`
      );
    }

    const sessionId = args.sessionId as string;
    const projectDir = flags['project-dir'] || process.cwd();

    try {
      this.log(`\n${chalk.blue('●')} Loading Claude Code session: ${chalk.cyan(sessionId)}\n`);

      // Load session transcript
      const claudeSession = await loadClaudeSession(sessionId, projectDir);

      this.log(`${chalk.green('✓')} Parsed transcript: ${claudeSession.messages.length} messages`);

      // Filter to conversation messages
      const conversation = filterConversationMessages(claudeSession.messages);
      this.log(
        `${chalk.green('✓')} Conversation: ${conversation.length} messages (${conversation.filter(m => m.type === 'user').length} user, ${conversation.filter(m => m.type === 'assistant').length} assistant)`
      );

      // Connect to daemon
      const client = createClient(daemonUrl);

      // Extract first user message as description
      const firstUserMessage = conversation.find(m => m.type === 'user');
      const description = firstUserMessage?.message?.content
        ? typeof firstUserMessage.message.content === 'string'
          ? firstUserMessage.message.content.substring(0, 200)
          : JSON.stringify(firstUserMessage.message.content).substring(0, 200)
        : 'Imported Claude Code session';

      // Create Agor session
      const agorSession: Partial<Session> & { session_id: SessionID; created_by: string } = {
        session_id: generateId() as SessionID,
        agentic_tool: 'claude-code',
        status: 'completed',
        description: description,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        created_by: 'cli-import',
        repo: {
          cwd: claudeSession.cwd || projectDir,
          managed_worktree: false,
        },
        git_state: {
          ref: 'unknown',
          base_sha: '',
          current_sha: '',
        },
        genealogy: {
          children: [],
        },
        tasks: [],
        message_count: conversation.length,
        tool_use_count: 0,
      };

      // Create session in daemon
      const sessionsService = client.service('sessions');
      // biome-ignore lint/suspicious/noExplicitAny: Feathers service methods not properly typed
      const created = (await (sessionsService as any).create(agorSession)) as Session;

      this.log(`${chalk.green('✓')} Created Agor session: ${chalk.cyan(created.session_id)}`);

      // Convert transcript messages to Agor messages
      const messages = transcriptsToMessages(conversation, created.session_id);
      this.log(`${chalk.blue('●')} Converting ${messages.length} messages...`);

      // Bulk insert messages in batches to avoid timeout
      // biome-ignore lint/suspicious/noExplicitAny: Custom service path not in type definitions
      const messagesBulkService = client.service('messages/bulk' as any);
      const batchSize = 100;
      const totalMessages = messages.length;

      for (let i = 0; i < totalMessages; i += batchSize) {
        const end = Math.min(i + batchSize, totalMessages);
        const batch = messages.slice(i, end);

        // biome-ignore lint/suspicious/noExplicitAny: Feathers service methods not properly typed
        await (messagesBulkService as any).create(batch);

        this.log(`${chalk.blue('●')} Processed ${end}/${totalMessages} messages...`);
      }

      this.log(`${chalk.green('✓')} Saved ${totalMessages} messages to database`);

      // Extract tasks from user messages
      const tasks = extractTasksFromMessages(messages, created.session_id);
      this.log(`${chalk.blue('●')} Extracting ${tasks.length} tasks from user messages...`);

      // Bulk insert tasks in batches
      // biome-ignore lint/suspicious/noExplicitAny: Custom service path not in type definitions
      const tasksBulkService = client.service('tasks/bulk' as any);
      const taskBatchSize = 100;
      const totalTasks = tasks.length;
      const createdTasks = [];

      for (let i = 0; i < totalTasks; i += taskBatchSize) {
        const end = Math.min(i + taskBatchSize, totalTasks);
        const batch = tasks.slice(i, end);

        // biome-ignore lint/suspicious/noExplicitAny: Feathers service methods not properly typed
        const batchResult = await (tasksBulkService as any).create(batch);
        createdTasks.push(...batchResult);

        this.log(`${chalk.blue('●')} Created ${end}/${totalTasks} tasks...`);
      }

      this.log(`${chalk.green('✓')} Created ${totalTasks} tasks`);

      // Update session with task IDs
      const taskIds = createdTasks.map(t => t.task_id);
      // biome-ignore lint/suspicious/noExplicitAny: FeathersJS service type doesn't include patch
      await (sessionsService as any).patch(created.session_id, {
        tasks: taskIds,
      });

      // Link messages to their tasks based on message_range
      this.log(`${chalk.blue('●')} Linking messages to tasks...`);
      let linkedCount = 0;

      // Batch updates by collecting message_id -> task_id mappings
      const messageLinkUpdates: { messageId: string; taskId: string }[] = [];

      for (const task of createdTasks) {
        const { start_index, end_index } = task.message_range;

        // Collect all messages in this range
        for (let idx = start_index; idx <= end_index; idx++) {
          const message = messages[idx];
          if (message) {
            messageLinkUpdates.push({
              messageId: message.message_id,
              taskId: task.task_id,
            });
            linkedCount++;
          }
        }
      }

      // Use bulk link service if available, otherwise fall back to individual updates
      try {
        // biome-ignore lint/suspicious/noExplicitAny: Custom service path not in type definitions
        const messageLinkService = client.service('messages/link-tasks' as any);
        // biome-ignore lint/suspicious/noExplicitAny: Custom service method
        await (messageLinkService as any).create({ updates: messageLinkUpdates });
      } catch {
        // Fallback: batch patch in groups of 100
        // biome-ignore lint/suspicious/noExplicitAny: Custom service path not in type definitions
        const messagesService = client.service('messages' as any);
        const batchSize = 100;
        for (let i = 0; i < messageLinkUpdates.length; i += batchSize) {
          const batch = messageLinkUpdates.slice(i, i + batchSize);
          await Promise.all(
            batch.map(update =>
              // biome-ignore lint/suspicious/noExplicitAny: FeathersJS service type doesn't include patch
              (messagesService as any).patch(update.messageId, { task_id: update.taskId })
            )
          );
          this.log(
            `${chalk.blue('●')} Linked ${Math.min(i + batchSize, messageLinkUpdates.length)}/${messageLinkUpdates.length} messages...`
          );
        }
      }

      this.log(
        `${chalk.green('✓')} Linked ${linkedCount} messages to ${createdTasks.length} tasks`
      );

      // Add to board if specified
      if (flags.board) {
        try {
          const boardsService = client.service('boards');
          // biome-ignore lint/suspicious/noExplicitAny: Feathers service methods not properly typed
          await (boardsService as any).patch(null, null, {
            query: { addSession: created.session_id, boardId: flags.board },
          });
          this.log(`${chalk.green('✓')} Added to board: ${chalk.cyan(flags.board)}`);
        } catch (error) {
          this.warn(
            `Failed to add to board "${flags.board}": ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      this.log(`\n${chalk.green('✓')} Successfully imported session!\n`);
      this.log(`View with: ${chalk.cyan(`agor session show ${created.session_id}`)}`);
      this.log('');

      // Close socket connection and wait for it to close
      await new Promise<void>(resolve => {
        client.io.once('disconnect', () => resolve());
        client.io.close();
        setTimeout(() => resolve(), 1000); // Fallback timeout
      });
      process.exit(0);
    } catch (error) {
      this.error(
        `Failed to load session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
