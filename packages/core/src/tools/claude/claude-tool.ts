/**
 * Claude Code Tool Implementation
 *
 * Current capabilities:
 * - ✅ Import sessions from transcript files
 * - ✅ Live execution via Anthropic SDK
 * - ❌ Create new sessions (waiting for SDK)
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateId } from '../../db/ids';
import type { MessagesRepository } from '../../db/repositories/messages';
import type { SessionRepository } from '../../db/repositories/sessions';
import type { Message, MessageID, SessionID, ToolUse } from '../../types';
import type { ImportOptions, ITool, SessionData, ToolCapabilities } from '../base';
import { loadClaudeSession } from './import/load-session';
import { transcriptsToMessages } from './import/message-converter';
import { ClaudePromptService } from './prompt-service';

export class ClaudeTool implements ITool {
  readonly toolType = 'claude-code' as const;
  readonly name = 'Claude Code';

  private promptService?: ClaudePromptService;

  constructor(
    private messagesRepo?: MessagesRepository,
    private sessionsRepo?: SessionRepository,
    private apiKey?: string
  ) {
    if (messagesRepo && sessionsRepo) {
      this.promptService = new ClaudePromptService(messagesRepo, sessionsRepo, apiKey);
    }
  }

  getCapabilities(): ToolCapabilities {
    return {
      supportsSessionImport: true, // ✅ We have transcript parsing
      supportsSessionCreate: false, // ❌ Waiting for SDK
      supportsLiveExecution: true, // ✅ Now supported via Anthropic SDK
      supportsSessionFork: false,
      supportsChildSpawn: false,
      supportsGitState: true, // Transcripts contain git state
      supportsStreaming: false, // Returns complete messages
    };
  }

  async checkInstalled(): Promise<boolean> {
    try {
      // Check if ~/.claude directory exists
      const claudeDir = path.join(os.homedir(), '.claude');
      const stats = await fs.stat(claudeDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async importSession(sessionId: string, options?: ImportOptions): Promise<SessionData> {
    // Load session using existing transcript parser
    const session = await loadClaudeSession(sessionId, options?.projectDir);

    // Convert messages to Agor format
    const messages = transcriptsToMessages(session.messages, session.sessionId as SessionID);

    // Extract metadata
    const metadata = {
      sessionId: session.sessionId,
      toolType: this.toolType,
      status: 'completed' as const, // Historical sessions are always completed
      createdAt: new Date(session.messages[0]?.timestamp || Date.now()),
      lastUpdatedAt: new Date(
        session.messages[session.messages.length - 1]?.timestamp || Date.now()
      ),
      workingDirectory: session.cwd || undefined,
      messageCount: session.messages.length,
    };

    return {
      sessionId: session.sessionId,
      toolType: this.toolType,
      messages,
      metadata,
      workingDirectory: session.cwd || undefined,
    };
  }

  /**
   * Execute a prompt against a session
   *
   * Creates user message, streams response from Claude, creates assistant message.
   * Returns both message IDs for tracking.
   */
  async executePrompt(
    sessionId: SessionID,
    prompt: string
  ): Promise<{ userMessageId: MessageID; assistantMessageId: MessageID }> {
    if (!this.promptService || !this.messagesRepo) {
      throw new Error('ClaudeTool not initialized with repositories for live execution');
    }

    // Get next message index
    const existingMessages = await this.messagesRepo.findBySessionId(sessionId);
    const nextIndex = existingMessages.length;

    // Create user message immediately
    const userMessage: Message = {
      message_id: generateId() as MessageID,
      session_id: sessionId,
      type: 'user',
      role: 'user',
      index: nextIndex,
      timestamp: new Date().toISOString(),
      content_preview: prompt.substring(0, 200),
      content: prompt,
    };

    await this.messagesRepo.create(userMessage);
    console.log(`📝 Created user message: ${userMessage.message_id}`);

    // Stream response from Claude
    const result = await this.promptService.promptSession(sessionId, prompt);

    // Extract tool uses from assistant message content
    const toolUses: ToolUse[] = [];
    if (Array.isArray(result.message.content)) {
      for (const block of result.message.content) {
        if (block.type === 'tool_use') {
          toolUses.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }
    }

    // Create content preview
    let contentPreview = '';
    // biome-ignore lint/suspicious/noExplicitAny: Anthropic SDK message content type
    const messageContent: string | any[] = result.message.content as any;
    if (typeof messageContent === 'string') {
      contentPreview = messageContent.substring(0, 200);
    } else if (Array.isArray(messageContent)) {
      const textBlock = messageContent.find((b: { type: string }) => b.type === 'text');
      if (textBlock && 'text' in textBlock) {
        contentPreview = String(textBlock.text).substring(0, 200);
      }
    }

    // Create assistant message
    const assistantMessage: Message = {
      message_id: generateId() as MessageID,
      session_id: sessionId,
      type: 'assistant',
      role: 'assistant',
      index: nextIndex + 1,
      timestamp: new Date().toISOString(),
      content_preview: contentPreview,
      // biome-ignore lint/suspicious/noExplicitAny: Anthropic SDK ContentBlock is compatible but has different type signature
      content: result.message.content as any,
      tool_uses: toolUses.length > 0 ? toolUses : undefined,
      metadata: {
        model: result.message.model,
        tokens: {
          input: result.inputTokens,
          output: result.outputTokens,
        },
        original_id: result.message.id,
      },
    };

    await this.messagesRepo.create(assistantMessage);
    console.log(`🤖 Created assistant message: ${assistantMessage.message_id}`);

    return {
      userMessageId: userMessage.message_id,
      assistantMessageId: assistantMessage.message_id,
    };
  }
}
