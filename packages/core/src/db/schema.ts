/**
 * Schema Re-Export with Runtime Dialect Detection
 *
 * This file dynamically exports from the correct schema based on the database dialect.
 * The dialect is determined at runtime from environment variables.
 */

import { getDatabaseDialect } from './schema-factory';
import * as sqliteSchema from './schema.sqlite';
import * as postgresSchema from './schema.postgres';

// Determine which schema to use based on runtime dialect
const dialect = getDatabaseDialect();
const schema = dialect === 'postgresql' ? postgresSchema : sqliteSchema;

// Re-export all tables
export const sessions = schema.sessions;
export const tasks = schema.tasks;
export const messages = schema.messages;
export const boards = schema.boards;
export const repos = schema.repos;
export const worktrees = schema.worktrees;
export const users = schema.users;
export const mcpServers = schema.mcpServers;
export const boardObjects = schema.boardObjects;
export const sessionMcpServers = schema.sessionMcpServers;
export const boardComments = schema.boardComments;

// Re-export all types (if any)
export type * from './schema.sqlite';
