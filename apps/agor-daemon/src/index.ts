/**
 * Agor Daemon
 *
 * FeathersJS backend providing REST + WebSocket API for session management.
 * Auto-started by CLI, provides unified interface for GUI and CLI clients.
 */

import 'dotenv/config';
import { loadConfig } from '@agor/core/config';
import { createDatabase, MessagesRepository, SessionRepository } from '@agor/core/db';
import { ClaudeTool } from '@agor/core/tools';
import type { SessionID } from '@agor/core/types';
import express, { rest } from '@feathersjs/express';
import type { Params } from '@feathersjs/feathers';
import { feathers } from '@feathersjs/feathers';
import socketio from '@feathersjs/socketio';
import type { CorsOptions } from 'cors';
import { createBoardsService } from './services/boards';
import { createMessagesService } from './services/messages';
import { createReposService } from './services/repos';
import { createSessionsService } from './services/sessions';
import { createTasksService } from './services/tasks';

/**
 * Extended Params with route ID parameter
 */
interface RouteParams extends Params {
  route?: {
    id?: string;
  };
}

const PORT = process.env.PORT || 3030;
const DB_PATH = process.env.AGOR_DB_PATH || 'file:~/.agor/agor.db';

// Main async function
async function main() {
  // Load config to get API key
  const config = await loadConfig();
  const apiKey = config.credentials?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  No ANTHROPIC_API_KEY found in config or environment');
    console.warn('   Run: agor config set credentials.ANTHROPIC_API_KEY <your-key>');
    console.warn('   Or set ANTHROPIC_API_KEY environment variable');
  }

  // Create Feathers app
  const app = express(feathers());

  // Parse JSON
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Configure REST and Socket.io with CORS
  app.configure(rest());
  app.configure(
    socketio({
      cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true,
      },
    })
  );

  // Initialize database
  console.log(`📦 Connecting to database: ${DB_PATH}`);
  const db = createDatabase({ url: DB_PATH });

  // Initialize repositories for ClaudeTool
  const messagesRepo = new MessagesRepository(db);
  const sessionsRepo = new SessionRepository(db);

  // Initialize ClaudeTool with repositories and API key
  const claudeTool = new ClaudeTool(messagesRepo, sessionsRepo, apiKey);

  // Register services
  app.use('/sessions', createSessionsService(db));
  app.use('/tasks', createTasksService(db));
  const messagesService = createMessagesService(db);
  app.use('/messages', messagesService);
  app.use('/boards', createBoardsService(db));
  app.use('/repos', createReposService(db));

  // Configure custom route for bulk message creation
  app.use('/messages/bulk', {
    async create(data: unknown[]) {
      return messagesService.createMany(data);
    },
  });

  // Configure custom methods for sessions service
  const sessionsService = app.service('sessions');
  app.use('/sessions/:id/fork', {
    async create(data: { prompt: string; task_id?: string }, params: RouteParams) {
      const id = params.route?.id;
      if (!id) throw new Error('Session ID required');
      return sessionsService.fork(id, data, params);
    },
  });

  app.use('/sessions/:id/spawn', {
    async create(data: { prompt: string; agent?: string; task_id?: string }, params: RouteParams) {
      const id = params.route?.id;
      if (!id) throw new Error('Session ID required');
      return sessionsService.spawn(id, data, params);
    },
  });

  app.use('/sessions/:id/genealogy', {
    async find(_data: undefined, params: RouteParams) {
      const id = params.route?.id;
      if (!id) throw new Error('Session ID required');
      return sessionsService.getGenealogy(id, params);
    },
  });

  app.use('/sessions/:id/prompt', {
    async create(data: { prompt: string }, params: RouteParams) {
      const id = params.route?.id;
      if (!id) throw new Error('Session ID required');
      if (!data.prompt) throw new Error('Prompt required');

      // Execute prompt via ClaudeTool
      const result = await claudeTool.executePrompt(id as SessionID, data.prompt);

      return {
        success: true,
        userMessageId: result.userMessageId,
        assistantMessageId: result.assistantMessageId,
      };
    },
  });

  // Configure custom methods for tasks service
  const tasksService = app.service('tasks');

  // Configure custom route for bulk task creation
  app.use('/tasks/bulk', {
    async create(data: unknown[]) {
      return tasksService.createMany(data);
    },
  });

  app.use('/tasks/:id/complete', {
    async create(
      data: { git_state?: { sha_at_end?: string; commit_message?: string } },
      params: RouteParams
    ) {
      const id = params.route?.id;
      if (!id) throw new Error('Task ID required');
      return tasksService.complete(id, data, params);
    },
  });

  app.use('/tasks/:id/fail', {
    async create(data: { error?: string }, params: RouteParams) {
      const id = params.route?.id;
      if (!id) throw new Error('Task ID required');
      return tasksService.fail(id, data, params);
    },
  });

  // Configure custom methods for repos service
  const reposService = app.service('repos');
  app.use('/repos/clone', {
    async create(data: { url: string; name?: string; destination?: string }, params: RouteParams) {
      return reposService.cloneRepository(data, params);
    },
  });

  app.use('/repos/:id/worktrees', {
    async create(data: { name: string; ref: string; createBranch?: boolean }, params: RouteParams) {
      const id = params.route?.id;
      if (!id) throw new Error('Repo ID required');
      return reposService.createWorktree(id, data, params);
    },
  });

  app.use('/repos/:id/worktrees/:name', {
    async remove(_id: unknown, params: RouteParams & { route?: { name?: string } }) {
      const id = params.route?.id;
      const name = params.route?.name;
      if (!id) throw new Error('Repo ID required');
      if (!name) throw new Error('Worktree name required');
      return reposService.removeWorktree(id, name, params);
    },
  });

  // Configure custom methods for boards service
  const boardsService = app.service('boards');
  app.use('/boards/:id/sessions', {
    async create(data: { sessionId: string }, params: RouteParams) {
      const id = params.route?.id;
      if (!id) throw new Error('Board ID required');
      if (!data.sessionId) throw new Error('Session ID required');
      return boardsService.addSession(id, data.sessionId, params);
    },
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      version: '0.1.0',
      database: DB_PATH,
    });
  });

  // Error handling
  app.use(express.errorHandler());

  // Start server
  app.listen(PORT).then(() => {
    console.log(`🚀 Agor daemon running at http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Services:`);
    console.log(`     - /sessions`);
    console.log(`     - /tasks`);
    console.log(`     - /messages`);
    console.log(`     - /boards`);
    console.log(`     - /repos`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n⏳ Shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\n⏳ Shutting down gracefully...');
    process.exit(0);
  });
}

// Start the daemon
main().catch(error => {
  console.error('Failed to start daemon:', error);
  process.exit(1);
});
