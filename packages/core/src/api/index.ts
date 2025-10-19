/**
 * Feathers Client for Agor
 *
 * Shared client library for connecting to agor-daemon from CLI and UI
 */

import type {
  Board,
  ContextFileDetail,
  ContextFileListItem,
  MCPServer,
  Repo,
  Session,
  Task,
  User,
} from '@agor/core/types';
import authentication from '@feathersjs/authentication-client';
import type { Application, Paginated, Params } from '@feathersjs/feathers';
import { feathers } from '@feathersjs/feathers';
import socketio from '@feathersjs/socketio-client';
import io, { type Socket } from 'socket.io-client';

/**
 * Authentication result from Feathers authentication
 */
export interface AuthenticationResult {
  accessToken: string;
  authentication: {
    strategy: string;
    accessToken?: string;
    payload?: Record<string, unknown>;
  };
  user?: User;
  [key: string]: unknown;
}

/**
 * Service interfaces for type safety
 */
export interface ServiceTypes {
  sessions: Session;
  tasks: Task;
  boards: Board;
  repos: Repo;
  users: User;
  'mcp-servers': MCPServer;
  context: ContextFileListItem | ContextFileDetail; // GET /context returns list, GET /context/:path returns detail
}

/**
 * Feathers service with find method properly typed and event emitter methods
 */
export interface AgorService<T> {
  // CRUD methods
  find(params?: Params): Promise<Paginated<T> | T[]>;
  get(id: string, params?: Params): Promise<T>;
  create(data: Partial<T>, params?: Params): Promise<T>;
  update(id: string, data: T, params?: Params): Promise<T>;
  patch(id: string, data: Partial<T>, params?: Params): Promise<T>;
  remove(id: string, params?: Params): Promise<T>;

  // Event emitter methods (for real-time updates)
  on(event: string, handler: (data: T) => void): void;
  removeListener(event: string, handler: (data: T) => void): void;
}

/**
 * Agor client with socket.io connection exposed for lifecycle management
 */
export interface AgorClient extends Omit<Application<ServiceTypes>, 'service'> {
  io: Socket;

  // Override service method to return our typed AgorService
  service<K extends keyof ServiceTypes>(path: K): AgorService<ServiceTypes[K]>;
  // Allow dynamic service paths for custom routes
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic service paths require unknown type
  service(path: string): AgorService<any>;

  // Authentication methods (from @feathersjs/authentication-client)
  authenticate(credentials?: {
    strategy?: string;
    email?: string;
    password?: string;
    accessToken?: string;
  }): Promise<AuthenticationResult>;
  logout(): Promise<AuthenticationResult | null>;
  reAuthenticate(force?: boolean): Promise<AuthenticationResult>;
}

/**
 * Create Feathers client connected to agor-daemon
 *
 * @param url - Daemon URL (default: http://localhost:3030)
 * @param autoConnect - Auto-connect socket (default: true for CLI, false for React)
 * @returns Feathers client instance with socket exposed
 */
export function createClient(
  url: string = 'http://localhost:3030',
  autoConnect: boolean = true
): AgorClient {
  // Configure socket.io with better defaults for React StrictMode and reconnection
  const socket = io(url, {
    // Auto-connect by default for CLI, manual control for React hooks
    autoConnect,
    // Reconnection settings (less aggressive to prevent socket exhaustion)
    reconnection: true,
    reconnectionDelay: 2000, // Wait 2s before first reconnect attempt
    reconnectionDelayMax: 10000, // Max 10s between attempts
    reconnectionAttempts: 10, // Try 10 times before giving up
    // Timeout settings
    timeout: 10000,
    // Transports (WebSocket preferred, fallback to polling)
    transports: ['websocket', 'polling'],
    // Connection lifecycle settings
    closeOnBeforeunload: true, // Close socket when page unloads
  });

  const client = feathers<ServiceTypes>() as AgorClient;

  client.configure(socketio(socket));

  // Configure authentication with localStorage if available (browser only)
  const storage =
    typeof globalThis !== 'undefined' && 'localStorage' in globalThis
      ? (globalThis as typeof globalThis & { localStorage: Storage }).localStorage
      : undefined;

  client.configure(authentication({ storage }));
  client.io = socket;

  return client;
}

/**
 * Check if daemon is running
 *
 * @param url - Daemon URL
 * @returns true if daemon is reachable
 */
export async function isDaemonRunning(url: string = 'http://localhost:3030'): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}
