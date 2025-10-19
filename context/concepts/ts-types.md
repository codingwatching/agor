# TypeScript Types Reference

This document catalogues all important TypeScript types defined across the Agor codebase, organized by domain and location.

## Core Types (`packages/core/src/types/`)

### Identity Types (`id.ts`)

**Branded UUID Types:**

- `UUID` - Base UUIDv7 type with brand for type safety
- `ShortID` - 8-16 character prefix for UI display
- `IDPrefix` - Any length ID prefix for fuzzy matching

**Entity IDs:**

- `SessionID` - Session identifier (UUIDv7)
- `TaskID` - Task identifier (UUIDv7)
- `BoardID` - Board identifier (UUIDv7)
- `MessageID` - Message identifier (UUIDv7)
- `UserID` - User identifier (UUIDv7)
- `AgenticToolID` - Agentic tool identifier (UUIDv7)
- `AgentID` - **Deprecated**, use `AgenticToolID`

**Location:** `packages/core/src/types/id.ts`

**See also:** `context/concepts/id-management.md`

---

### Session Types (`session.ts`)

**Core Types:**

- `Session` - Main session container with genealogy, git state, concepts, tasks
- `GitState` - Git worktree state tracking (ref, base_sha, current_sha)
- `Genealogy` - Session parent/child relationships (fork/spawn)
- `SessionStatus` - Enum: `idle`, `running`, `paused`, `completed`, `failed`
- `PermissionMode` - Permission modes for agentic tools: `ask`, `auto`, `allow-all`
- `ClaudeCodePermissionMode` - Claude-specific modes
- `CodexPermissionMode` - Codex-specific modes

**Location:** `packages/core/src/types/session.ts`

**See also:** `context/concepts/models.md`, `context/concepts/core.md`

---

### Task Types (`task.ts`)

**Core Types:**

- `Task` - Work unit within a session with message range, git state, tool usage
- `TaskStatus` - Enum: `pending`, `running`, `completed`, `failed`, `cancelled`
- `MessageRange` - Defines conversation slice (start_index, end_index, timestamps)
- `ToolUseStats` - Aggregated tool usage metrics

**Location:** `packages/core/src/types/task.ts`

**See also:** `context/concepts/models.md`

---

### Message Types (`message.ts`)

**Core Types:**

- `Message` - Conversation message with role, content, tool uses
- `MessageRole` - Enum: `user`, `assistant`, `system`
- `MessageType` - Extended types including `file-history-snapshot`
- `ToolUse` - Tool invocation record (name, input, output, status)

**Location:** `packages/core/src/types/message.ts`

**See also:** `context/concepts/models.md`, `context/concepts/conversation-ui.md`

---

### Repository Types (`repo.ts`)

**Core Types:**

- `Repo` - Git repository record with worktrees, branches, metadata
- `Worktree` - Git worktree configuration (name, path, ref, session_id)
- `GitInfo` - Repository git metadata (default_branch, remote_url, head_sha)

**Location:** `packages/core/src/types/repo.ts`

**See also:** `context/concepts/models.md`, `context/explorations/worktree-ux-design.md`

---

### Board Types (`board.ts`)

**Core Types:**

- `Board` - Session organization container (like Trello)
- `BoardSession` - Session position on board (x, y coordinates)
- `Zone` - Canvas zone with trigger actions (for zone-based workflows)

**Location:** `packages/core/src/types/board.ts`

**See also:** `context/concepts/models.md`, `context/concepts/board-objects.md`

---

### User Types (`user.ts`)

**Core Types:**

- `User` - User account with email, password, emoji avatar
- `CreateUserInput` - User creation payload
- `UpdateUserInput` - User update payload

**Location:** `packages/core/src/types/user.ts`

**See also:** `context/concepts/auth.md`

---

### MCP Types (`mcp.ts`)

**Core Types:**

- `MCPServer` - MCP server configuration (name, transport, scope, capabilities)
- `MCPTransport` - Transport type: `stdio`, `sse`
- `MCPScope` - Scope level: `user`, `team`, `repo`, `session`
- `MCPSource` - Origin: `official`, `community`, `custom`
- `StdioTransportConfig` - stdio transport settings (command, args, env)
- `SSETransportConfig` - SSE transport settings (url, headers)

**Location:** `packages/core/src/types/mcp.ts`

**See also:** `context/concepts/mcp-integration.md`

---

### Presence Types (`presence.ts`)

**Core Types:**

- `UserPresence` - Real-time user presence state (user_id, board_id, cursor_position)
- `CursorPosition` - Canvas cursor coordinates (x, y, last_updated)

**Location:** `packages/core/src/types/presence.ts`

**See also:** `context/concepts/multiplayer.md`

---

### Context Types (`context.ts`)

**Core Types:**

- `ContextFileListItem` - File list entry (path, title, description)
- `ContextFileDetail` - Full file content with metadata

**Location:** `packages/core/src/types/context.ts`

**See also:** `context/concepts/core.md` (Concept primitive)

---

### Agent Types (`agent.ts`)

**Core Types:**

- `AgentType` - Agent discriminator: `claude-code`, `codex`, `gemini`, `cursor`
- Agent-specific configs: `ClaudeCodeConfig`, `CodexConfig`, `GeminiConfig`

**Location:** `packages/core/src/types/agent.ts`

**See also:** `context/concepts/agent-integration.md`

---

### Agentic Tool Types (`agentic-tool.ts`)

**Core Types:**

- `AgenticTool` - Generic agentic tool configuration
- `AgenticToolType` - Tool type enum

**Location:** `packages/core/src/types/agentic-tool.ts`

---

### Report Types (`report.ts`)

**Core Types:**

- `Report` - Task execution report (markdown file)
- `ReportPath` - File path identifier (e.g., `<session-id>/<task-id>.md`)

**Location:** `packages/core/src/types/report.ts`

**See also:** `context/concepts/core.md` (Report primitive)

---

### UI Types (`ui.ts`)

**Core Types:**

- UI-specific type definitions for React components

**Location:** `packages/core/src/types/ui.ts`

---

## Database Schema (`packages/core/src/db/schema.ts`)

**Drizzle ORM Schema:**

- `sessions` - Session table schema
- `tasks` - Task table schema
- `messages` - Message table schema
- `repos` - Repository table schema
- `boards` - Board table schema
- `users` - User table schema
- `mcp_servers` - MCP server configuration table
- `board_objects` - Board objects (zones, sessions) table
- `user_presence` - Real-time presence table

**Location:** `packages/core/src/db/schema.ts`

**Alternative:** `packages/drizzle-schema/src/schema.ts` (if using separate package)

**See also:** `context/concepts/architecture.md` (database design)

---

## API Client Types (`packages/core/src/api/index.ts`)

**FeathersJS Types:**

- `ServiceTypes` - Service interface map for type-safe client
- `AgorService<T>` - Generic service interface with CRUD methods
- `AgorClient` - Feathers client with socket.io exposed

**Location:** `packages/core/src/api/index.ts`

**See also:** `context/concepts/websockets.md`

---

## Configuration Types (`packages/core/src/config/types.ts`)

**Core Types:**

- `UnknownJson` - Escape hatch for user-provided JSON data (replaces `any` in config)

**Location:** `packages/core/src/config/types.ts`

---

## UI-Specific Types (`apps/agor-ui/src/types/`)

The UI package re-exports most core types but may extend them for UI-specific needs:

- `apps/agor-ui/src/types/index.ts` - Main export barrel
- Individual type files mirror core package structure

**See also:** `context/concepts/frontend-guidelines.md`

---

## Type Conventions

### Branded Types

Agor uses TypeScript's branded types for ID safety:

```typescript
export type UUID = string & { readonly __brand: 'UUID' };
export type SessionID = UUID;
export type TaskID = UUID;
```

This prevents accidental ID mismatches at compile time.

**See also:** `context/concepts/id-management.md`

### Enum vs Union Types

- **Status enums** use string literal unions: `'idle' | 'running' | 'completed'`
- **Agent types** use discriminated unions with `type` field
- Database enums use Drizzle's `text()` with `enum` validation

### JSON Storage

Types stored in JSON database columns:

- `Genealogy` - Session relationships
- `GitState` - Git worktree state
- `ModelConfig` - Agent model configuration
- `ToolUseStats` - Aggregated metrics

**See also:** `context/concepts/architecture.md` (hybrid storage strategy)

---

## Common Type Patterns

### Repository Pattern

All database entities follow the repository pattern:

```typescript
export interface Repository<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

**Location:** `apps/agor-daemon/src/adapters/drizzle.ts`

### Service Pattern

FeathersJS services use generic service interface:

```typescript
export interface AgorService<T> {
  find(params?: Params): Promise<Paginated<T> | T[]>;
  get(id: string, params?: Params): Promise<T>;
  create(data: Partial<T>, params?: Params): Promise<T>;
  update(id: string, data: T, params?: Params): Promise<T>;
  patch(id: string, data: Partial<T>, params?: Params): Promise<T>;
  remove(id: string, params?: Params): Promise<T>;
}
```

**Location:** `packages/core/src/api/index.ts`

---

## Type Safety Best Practices

1. **Use branded types** for IDs to prevent mixing different entity IDs
2. **Avoid `any`** - use `unknown` or `UnknownJson` for truly dynamic data
3. **Prefer union types** over enums for string literals (better serialization)
4. **Use `Partial<T>`** for update operations
5. **Repository interface** for all database access (type-safe ORM wrapper)
6. **Service types** for all API access (type-safe Feathers client)

---

## Related Documentation

- `context/concepts/id-management.md` - UUIDv7, branded types, short IDs
- `context/concepts/models.md` - Canonical data model definitions
- `context/concepts/architecture.md` - Database schema and hybrid storage
- `context/concepts/frontend-guidelines.md` - React/TypeScript patterns
- `context/concepts/agent-integration.md` - Agent-specific types

---

_Last updated: 2025-10-19_
