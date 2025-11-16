# PostgreSQL Support: Design & Implementation Plan

**Status**: 🔧 Design Phase
**Target**: Multi-database support (SQLite + PostgreSQL)
**Related**: Database architecture, configuration management, Drizzle ORM

---

## Overview

This document outlines the design and implementation strategy for adding PostgreSQL support to Agor, enabling users to choose between SQLite (local/embedded) and PostgreSQL (production/team) deployments while maintaining a single codebase.

**Core Principle**: Database-agnostic architecture with compile-time dialect selection and runtime configuration.

---

## Motivation

### Why PostgreSQL?

1. **Production deployments**: Better concurrency, connection pooling, and scalability for multi-user teams
2. **Hosted solutions**: Cloud providers (Render, Railway, Fly.io) prefer PostgreSQL
3. **Advanced features**: Full-text search, JSONB operators, better transaction isolation
4. **Team collaboration**: Centralized database vs. distributed SQLite files

### Why Keep SQLite?

1. **Local development**: Zero-config, embedded, no separate database process
2. **Single-user setups**: Perfect for solo developers (Agor's primary use case)
3. **Portability**: Single file, easy backups, simple migrations
4. **Performance**: Faster for read-heavy workloads with minimal concurrent writes

---

## Current Architecture Analysis

### Database Configuration (`packages/core/src/db/client.ts`)

**Current State**:

- Hard-coded LibSQL client (SQLite-compatible)
- Supports local file (`file:~/.agor/agor.db`) and Turso remote (`libsql://...`)
- No dialect switching mechanism

```typescript
export interface DbConfig {
  url: string; // 'file:~/.agor/agor.db' or 'libsql://...'
  authToken?: string; // Turso only
  syncUrl?: string; // Turso embedded replica
  syncInterval?: number; // Default 60s
}
```

**SQLite Pragmas** (packages/core/src/db/client.ts:94-107):

```typescript
await client.execute('PRAGMA journal_mode = WAL'); // Concurrent reads/writes
await client.execute('PRAGMA busy_timeout = 5000'); // Retry on lock
await client.execute('PRAGMA foreign_keys = ON'); // CASCADE support
```

### Schema Definition (`packages/core/src/db/schema.ts`)

**Current State**:

- Uses `sqliteTable` from `drizzle-orm/sqlite-core`
- SQLite-specific type mappings:
  - `integer({ mode: 'timestamp_ms' })` → timestamps as milliseconds
  - `integer({ mode: 'boolean' })` → booleans as 0/1
  - `text({ mode: 'json' })` → JSON as text
  - `text(length: 36)` → UUIDv7 strings

**Cross-database compatibility**:

- ✅ JSON blobs (already using `text({ mode: 'json' })`)
- ✅ Foreign keys with CASCADE/SET NULL
- ✅ Indexes (all standard CREATE INDEX syntax)
- ❌ Booleans (need `boolean()` for PostgreSQL)
- ❌ Timestamps (need `timestamp()` for PostgreSQL)
- ❌ JSON type (need `jsonb` for PostgreSQL)

### Migrations (`packages/core/drizzle/`)

**Current State**:

- 11 migration files (0000-0010)
- SQLite-specific patterns:
  - `PRAGMA foreign_keys=OFF` before schema changes
  - Table recreation pattern (no ALTER COLUMN support)
  - `PRAGMA foreign_keys=ON` after schema changes
  - `sqlite_master` introspection queries

**PostgreSQL Migration Differences**:

- ✅ Transactional DDL (can run all statements in one transaction)
- ✅ `ALTER TABLE ADD COLUMN IF NOT EXISTS` (native support)
- ✅ `ALTER TABLE ALTER COLUMN` (change types, add constraints)
- ❌ No PRAGMA statements
- ❌ Different system catalog (`information_schema`, `pg_catalog` vs. `sqlite_master`)

### Migration Runner (`packages/core/src/db/migrate.ts`)

**SQLite-Specific Code**:

1. **Migration table check** (line 47-50):

```typescript
const result = await db.run(sql`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name='__drizzle_migrations'
`);
```

2. **Auto-increment tracking** (line 82-86):

```typescript
CREATE TABLE __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite syntax
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
```

3. **Manual hashing** for migration status checks (line 136-149)

### Drizzle Config (`packages/core/drizzle.config.ts`)

**Current State**:

```typescript
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite', // Hard-coded
  dbCredentials: {
    url: expandPath(process.env.AGOR_DB_PATH || 'file:~/.agor/agor.db'),
  },
});
```

### Configuration Schema (`packages/core/src/config/types.ts`)

**Current State**:

- No database configuration options
- Assumes SQLite at `~/.agor/agor.db`
- Environment variable: `AGOR_DB_PATH` (SQLite file path only)

---

## Design: Multi-Database Support

### 1. Configuration Schema

Add database configuration to `AgorConfig`:

```typescript
// packages/core/src/config/types.ts

export interface AgorDatabaseSettings {
  /** Database dialect (default: 'sqlite') */
  dialect?: 'sqlite' | 'postgresql';

  /** SQLite configuration */
  sqlite?: {
    /** Database file path (default: '~/.agor/agor.db') */
    path?: string;

    /** Enable WAL mode (default: true) */
    walMode?: boolean;

    /** Busy timeout in ms (default: 5000) */
    busyTimeout?: number;
  };

  /** PostgreSQL configuration */
  postgresql?: {
    /** Connection URL (postgresql://user:pass@host:port/db) */
    url?: string;

    /** Individual connection parameters (alternative to URL) */
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;

    /** Connection pool settings */
    pool?: {
      min?: number; // Default: 2
      max?: number; // Default: 10
      idleTimeout?: number; // Default: 30000ms
    };

    /** SSL/TLS configuration */
    ssl?:
      | boolean
      | {
          rejectUnauthorized?: boolean;
          ca?: string;
          cert?: string;
          key?: string;
        };

    /** Schema name (default: 'public') */
    schema?: string;
  };
}

export interface AgorConfig {
  // ... existing fields

  /** Database configuration */
  database?: AgorDatabaseSettings;
}
```

**Config.yaml example (SQLite)**:

```yaml
database:
  dialect: sqlite
  sqlite:
    path: ~/.agor/agor.db
    walMode: true
    busyTimeout: 5000
```

**Config.yaml example (PostgreSQL)**:

```yaml
database:
  dialect: postgresql
  postgresql:
    url: postgresql://agor:secret@localhost:5432/agor
    pool:
      min: 2
      max: 10
    ssl: false
```

**Environment variable precedence**:

```bash
# SQLite (current behavior)
AGOR_DB_PATH=~/.agor/custom.db

# PostgreSQL (new)
DATABASE_URL=postgresql://user:pass@host:port/db
PGHOST=localhost
PGPORT=5432
PGDATABASE=agor
PGUSER=agor
PGPASSWORD=secret
```

### 2. Schema Abstraction Layer

Create dialect-agnostic schema factory:

```typescript
// packages/core/src/db/schema-factory.ts

import { PgDatabase } from 'drizzle-orm/pg-core';
import { LibSQLDatabase } from 'drizzle-orm/libsql';

export type DatabaseDialect = 'sqlite' | 'postgresql';

/**
 * Get current database dialect from config
 */
export function getDatabaseDialect(): DatabaseDialect {
  const config = loadConfigSync();
  return config.database?.dialect || 'sqlite';
}

/**
 * Cross-database type mappings
 */
export function getColumnTypes(dialect: DatabaseDialect) {
  if (dialect === 'postgresql') {
    return {
      id: () => text('id', { length: 36 }),
      timestamp: () => timestamp('timestamp', { mode: 'date', withTimezone: true }),
      boolean: () => boolean('boolean'),
      json: <T>() => jsonb('data').$type<T>(),
    };
  }

  // SQLite (default)
  return {
    id: () => text('id', { length: 36 }),
    timestamp: () => integer('timestamp', { mode: 'timestamp_ms' }),
    boolean: () => integer('boolean', { mode: 'boolean' }),
    json: <T>() => text('data', { mode: 'json' }).$type<T>(),
  };
}
```

**Approach 1: Conditional Schema (Recommended)**

Keep single `schema.ts` with conditional types:

```typescript
// packages/core/src/db/schema.ts

import { sqliteTable, pgTable } from 'drizzle-orm/...';
import { getDatabaseDialect, getColumnTypes } from './schema-factory';

const dialect = getDatabaseDialect();
const tableFactory = dialect === 'postgresql' ? pgTable : sqliteTable;
const types = getColumnTypes(dialect);

export const sessions = tableFactory(
  'sessions',
  {
    session_id: types.id().primaryKey(),
    created_at: types.timestamp().notNull(),
    status: text('status', { enum: [...] }).notNull(),
    // ... rest of schema
  },
  (table) => ({
    statusIdx: index('sessions_status_idx').on(table.status),
    // ... indexes
  })
);
```

**Approach 2: Separate Schema Files**

```
packages/core/src/db/
├── schema.ts              # Exports based on dialect
├── schema.sqlite.ts       # SQLite-specific schema
├── schema.postgresql.ts   # PostgreSQL-specific schema
└── schema-factory.ts      # Dialect detection
```

**Recommendation**: Use Approach 1 (conditional schema) to avoid duplication and keep migrations easier.

### 3. Client Factory Refactor

Replace LibSQL-only client with dialect-aware factory:

```typescript
// packages/core/src/db/client.ts

import { createClient as createLibSQLClient } from '@libsql/client';
import { drizzle as drizzleSQLite } from 'drizzle-orm/libsql';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = LibSQLDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;

/**
 * Create database client based on configured dialect
 */
export function createDatabase(config: DbConfig): Database {
  const dialect = config.dialect || 'sqlite';

  if (dialect === 'postgresql') {
    return createPostgresDatabase(config);
  }

  return createSQLiteDatabase(config);
}

/**
 * Create PostgreSQL database client
 */
function createPostgresDatabase(config: DbConfig): PostgresJsDatabase<typeof schema> {
  const url = config.url || buildPostgresUrl(config);

  const client = postgres(url, {
    max: config.pool?.max || 10,
    idle_timeout: config.pool?.idleTimeout || 30,
    ssl: config.ssl,
  });

  return drizzlePostgres(client, { schema });
}

/**
 * Create SQLite database client (existing implementation)
 */
function createSQLiteDatabase(config: DbConfig): LibSQLDatabase<typeof schema> {
  const client = createLibSQLClient({
    url: expandPath(config.url),
    authToken: config.authToken,
    syncUrl: config.syncUrl,
    syncInterval: config.syncInterval,
  });

  const db = drizzleSQLite(client, { schema });

  // Configure SQLite pragmas
  void configureSQLitePragmas(client);

  return db;
}

/**
 * Configure SQLite pragmas (only for SQLite)
 */
async function configureSQLitePragmas(client: Client): Promise<void> {
  // Only run for SQLite
  try {
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA busy_timeout = 5000');
    await client.execute('PRAGMA foreign_keys = ON');
  } catch (error) {
    console.warn('⚠️  Failed to configure SQLite pragmas:', error);
  }
}
```

### 4. Migration System Updates

#### 4.1 Drizzle Config (Dual Dialect)

```typescript
// packages/core/drizzle.config.ts

import { defineConfig } from 'drizzle-kit';
import { expandPath } from './dist/utils/path.js';
import { loadConfigSync } from './dist/config/config-manager.js';

const config = loadConfigSync();
const dialect = config.database?.dialect || 'sqlite';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect,
  dbCredentials:
    dialect === 'postgresql'
      ? { url: config.database?.postgresql?.url || process.env.DATABASE_URL }
      : { url: expandPath(config.database?.sqlite?.path || 'file:~/.agor/agor.db') },
});
```

#### 4.2 Migration Runner (Dialect-Aware)

```typescript
// packages/core/src/db/migrate.ts

/**
 * Check if migrations tracking table exists
 */
async function hasMigrationsTable(db: Database, dialect: DatabaseDialect): Promise<boolean> {
  if (dialect === 'postgresql') {
    const result = await db.run(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'
    `);
    return result.rows.length > 0;
  }

  // SQLite
  const result = await db.run(sql`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='__drizzle_migrations'
  `);
  return result.rows.length > 0;
}

/**
 * Bootstrap migrations table (dialect-aware)
 */
async function bootstrapMigrations(db: Database, dialect: DatabaseDialect): Promise<void> {
  if (dialect === 'postgresql') {
    await db.run(sql`
      CREATE TABLE __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `);
  } else {
    await db.run(sql`
      CREATE TABLE __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  }
}
```

#### 4.3 Migration Files (Dual Dialect)

**Option A: Separate migration folders** (Recommended)

```
packages/core/
├── drizzle.sqlite/
│   ├── 0000_pretty_mac_gargan.sql
│   ├── 0001_organic_stick.sql
│   └── meta/
└── drizzle.postgresql/
    ├── 0000_initial_schema.sql
    ├── 0001_add_archive_columns.sql
    └── meta/
```

**Option B: Conditional migrations** (Complex)

```typescript
// Migration runtime checks dialect and applies correct SQL
```

**Recommendation**: Use Option A (separate folders) with Drizzle's multi-dialect support.

#### 4.4 Migration Generation Workflow

```bash
# Generate SQLite migrations (default)
pnpm db:generate:sqlite

# Generate PostgreSQL migrations
pnpm db:generate:postgres

# Or auto-detect from config
pnpm db:generate
```

**Package.json scripts**:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:generate:sqlite": "AGOR_DB_DIALECT=sqlite drizzle-kit generate",
    "db:generate:postgres": "AGOR_DB_DIALECT=postgresql drizzle-kit generate"
  }
}
```

### 5. SQLite-Specific Migration Patterns

**Current pattern** (table recreation for ALTER COLUMN):

```sql
PRAGMA foreign_keys=OFF;
CREATE TABLE `worktrees_new` (...);
INSERT INTO `worktrees_new` SELECT ... FROM `worktrees`;
DROP TABLE `worktrees`;
ALTER TABLE `worktrees_new` RENAME TO `worktrees`;
PRAGMA foreign_keys=ON;
```

**PostgreSQL equivalent**:

```sql
-- No PRAGMA needed (transactional DDL)
ALTER TABLE worktrees ADD COLUMN archived BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE worktrees ADD COLUMN archived_at BIGINT;
```

**Solution**: Drizzle generates dialect-specific SQL automatically when using separate migration folders.

---

## Implementation Plan

### Phase 1: Configuration & Type System

**Goal**: Add PostgreSQL config without breaking existing SQLite behavior

1. ✅ Add `AgorDatabaseSettings` to config types
2. ✅ Update `config-manager.ts` to load database config
3. ✅ Add environment variable resolution (`DATABASE_URL`, `PG*`)
4. ✅ Create `schema-factory.ts` for dialect detection
5. ✅ Add `getDatabaseDialect()` helper

**Testing**:

- Load config with `dialect: sqlite` (default)
- Load config with `dialect: postgresql`
- Environment variable precedence

### Phase 2: Schema Abstraction

**Goal**: Make schema.ts work with both dialects

1. ✅ Install PostgreSQL dependencies (`drizzle-orm/pg-core`, `postgres`)
2. ✅ Create conditional type factory (`getColumnTypes()`)
3. ✅ Refactor `schema.ts` to use conditional types
4. ✅ Test schema compilation for both dialects

**Key Changes**:

- Replace `sqliteTable` → `tableFactory` (dialect-aware)
- Replace `integer({ mode: 'timestamp_ms' })` → `types.timestamp()`
- Replace `integer({ mode: 'boolean' })` → `types.boolean()`
- Replace `text({ mode: 'json' })` → `types.json()`

**Testing**:

- Generate types for SQLite schema
- Generate types for PostgreSQL schema
- Verify no type errors in repositories

### Phase 3: Client Factory

**Goal**: Support both LibSQL and PostgreSQL clients

1. ✅ Add `createPostgresDatabase()` function
2. ✅ Refactor `createDatabase()` to dispatch by dialect
3. ✅ Add connection pooling for PostgreSQL
4. ✅ Add SSL/TLS support for PostgreSQL
5. ✅ Conditionally apply SQLite pragmas

**Testing**:

- Connect to SQLite file
- Connect to PostgreSQL (local Docker)
- Connection pooling behavior
- SSL certificate validation

### Phase 4: Migration System

**Goal**: Build TypeScript migration builder and compile to SQL

**See**: `postgres-migration-strategy.md` for complete design

**Subtasks**:

1. ✅ Build migration utilities (`DialectUtils`, `MigrationBuilderImpl`, `sqlite-helpers`)
2. ✅ Convert existing migrations (0000-0010) to TypeScript
3. ✅ Create `compile-migrations.ts` script
4. ✅ Update `drizzle.config.ts` for dual dialect
5. ✅ Update `migrate.ts` for dialect-aware introspection
6. ✅ Test migration compilation (TypeScript → SQL)
7. ✅ Test migration runner with PostgreSQL
8. ✅ Test migration rollback (if supported)

**Timeline**: 7 days (see postgres-migration-strategy.md Phase 1-4)

**Testing**:

- Compile TypeScript migrations to SQL for both dialects
- Validate generated SQL matches hand-written equivalents
- Run migrations on fresh SQLite database
- Run migrations on fresh PostgreSQL database
- Apply migrations to existing SQLite database
- Test table recreation logic (SQLite-specific)

### Phase 5: CLI Commands

**Goal**: Add CLI commands for database management

```bash
# Initialize database (auto-detects dialect from config)
agor db init

# Migrate database
agor db migrate

# Check migration status
agor db status

# Switch database dialect (updates config)
agor config set database.dialect postgresql

# Set PostgreSQL connection URL
agor config set database.postgresql.url postgresql://...
```

**New Commands**:

- `agor db init --dialect postgresql` - Initialize PostgreSQL database
- `agor db migrate --target 0005` - Migrate to specific version
- `agor db reset` - Drop all tables and re-migrate

### Phase 6: Documentation

**Goal**: Document PostgreSQL setup and migration

1. ✅ Update `README.md` with database configuration
2. ✅ Create `docs/postgresql-setup.md`
3. ✅ Document connection string formats
4. ✅ Add Docker Compose example for local PostgreSQL
5. ✅ Update deployment guides (Render, Railway, Fly.io)

### Phase 7: Testing & Validation

**Goal**: Ensure both dialects work in production

1. ✅ Integration tests with real PostgreSQL
2. ✅ Test concurrent writes (PostgreSQL advantage)
3. ✅ Performance benchmarks (SQLite vs. PostgreSQL)
4. ✅ Test Turso (LibSQL remote) still works
5. ✅ Migration from SQLite to PostgreSQL (export/import)

---

## Key Challenges & Solutions

### Challenge 1: PRAGMA Statements

**Problem**: SQLite uses PRAGMA for configuration, PostgreSQL doesn't

**Solution**: Conditionally apply PRAGMAs only for SQLite dialect

```typescript
if (dialect === 'sqlite') {
  await client.execute('PRAGMA foreign_keys = ON');
}
```

### Challenge 2: Boolean Type

**Problem**: SQLite stores booleans as 0/1 integers, PostgreSQL has native boolean

**Solution**: Use conditional types in schema factory

```typescript
boolean: () =>
  dialect === 'postgresql' ? boolean('field') : integer('field', { mode: 'boolean' });
```

### Challenge 3: Timestamp Storage

**Problem**: SQLite stores timestamps as integers (ms), PostgreSQL uses native timestamp

**Solution**: Use Drizzle's mode parameter

```typescript
timestamp: () =>
  dialect === 'postgresql'
    ? timestamp('field', { mode: 'date', withTimezone: true })
    : integer('field', { mode: 'timestamp_ms' });
```

### Challenge 4: JSON Type

**Problem**: SQLite stores JSON as text, PostgreSQL has jsonb (binary JSON)

**Solution**: Use conditional JSON type

```typescript
json: <T>() =>
  dialect === 'postgresql' ? jsonb('data').$type<T>() : text('data', { mode: 'json' }).$type<T>();
```

### Challenge 5: Table Recreation (ALTER COLUMN)

**Problem**: SQLite doesn't support ALTER COLUMN, requires table recreation

**Solution**: Let Drizzle generate dialect-specific migration SQL

- SQLite: Full table recreation with `PRAGMA foreign_keys=OFF`
- PostgreSQL: Simple `ALTER TABLE` statements

### Challenge 6: System Catalog Queries

**Problem**: `sqlite_master` vs. `information_schema`

**Solution**: Conditional queries in migration runner

```typescript
if (dialect === 'postgresql') {
  return db.run(sql`SELECT table_name FROM information_schema.tables WHERE ...`);
}
return db.run(sql`SELECT name FROM sqlite_master WHERE ...`);
```

### Challenge 7: Migration Folder Structure & DRY Principle

**Problem**: Drizzle generates different SQL for different dialects, leading to 90%+ duplication

**Solution**: Use **TypeScript-based migration builder** (see `postgres-migration-strategy.md` for full design)

**Architecture**:

```
packages/core/
├── src/db/migrations/
│   ├── 0000-initial-schema.ts      # Single source of truth
│   ├── 0001-add-column.ts          # TypeScript migrations
│   └── utils/
│       ├── migration-builder.ts    # MigrationBuilder class
│       ├── dialect-utils.ts        # quote(), mapType(), formatDefault()
│       └── sqlite-helpers.ts       # recreateTable() for ALTER COLUMN
├── scripts/
│   └── compile-migrations.ts       # Generates SQL from TS
└── drizzle.sqlite/                 # Generated SQL (committed to git)
└── drizzle.postgresql/             # Generated SQL (committed to git)
```

**Example TypeScript Migration**:

```typescript
// 0001-add-parent-tool-use-id.ts
import { createMigration } from './utils/migration-builder';

export default createMigration({
  name: '0001_add_parent_tool_use_id',
  up: m => {
    m.addColumn('messages', {
      name: 'parent_tool_use_id',
      type: 'text',
      nullable: true,
    });
  },
});
```

**Generated SQLite**:

```sql
ALTER TABLE `messages` ADD `parent_tool_use_id` text;
```

**Generated PostgreSQL**:

```sql
ALTER TABLE messages ADD parent_tool_use_id TEXT;
```

**Benefits**:

- ✅ Single source of truth (no duplication)
- ✅ Type safety (catches errors at compile time)
- ✅ Utilities abstract dialect quirks (`quote()`, `mapType()`, `formatDefault()`)
- ✅ SQLite table recreation handled by `recreateTable()` helper
- ✅ PostgreSQL uses simple `ALTER TABLE` statements
- ✅ Easy to review (one file per migration, not two)

**See**: `context/explorations/postgres-migration-strategy.md` for full design, implementation plan, and code examples.

### Challenge 8: Data Migration (SQLite → PostgreSQL)

**Problem**: Users may want to migrate existing SQLite data to PostgreSQL

**Solution**: Create export/import utility

```bash
# Export SQLite to SQL dump
agor db export --format sql > dump.sql

# Import to PostgreSQL
agor db import --dialect postgresql dump.sql
```

**Alternative**: JSON export/import for cross-database compatibility

---

## Dependencies

### New Dependencies

```json
{
  "dependencies": {
    "postgres": "^3.4.3", // PostgreSQL client for Node.js
    "drizzle-orm": "^0.30.0" // Already installed (add pg support)
  },
  "devDependencies": {
    "@types/postgres": "^3.0.0" // TypeScript types
  }
}
```

### Peer Dependencies (User-Installed)

For PostgreSQL users:

```bash
# If self-hosting
docker run -d \
  --name agor-postgres \
  -e POSTGRES_USER=agor \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=agor \
  -p 5432:5432 \
  postgres:16-alpine

# Or use managed service (Neon, Supabase, Render)
```

---

## Configuration Examples

### Example 1: Local SQLite (Default)

```yaml
# ~/.agor/config.yaml
database:
  dialect: sqlite
  sqlite:
    path: ~/.agor/agor.db
```

### Example 2: Remote PostgreSQL (Render)

```yaml
database:
  dialect: postgresql
  postgresql:
    url: postgresql://agor:pwd@dpg-xxxxx.render.com/agor
    ssl:
      rejectUnauthorized: true
```

### Example 3: Local PostgreSQL (Docker)

```yaml
database:
  dialect: postgresql
  postgresql:
    host: localhost
    port: 5432
    database: agor
    user: agor
    password: secret
    pool:
      min: 2
      max: 10
```

### Example 4: Turso (LibSQL Remote)

```yaml
database:
  dialect: sqlite
  sqlite:
    url: libsql://my-db.turso.io
    authToken: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

---

## Migration Strategy

### For Existing Users (SQLite → PostgreSQL)

**Option 1: Fresh Start**

```bash
# 1. Export sessions/worktrees to JSON
agor export --output backup.json

# 2. Update config to PostgreSQL
agor config set database.dialect postgresql
agor config set database.postgresql.url postgresql://...

# 3. Initialize PostgreSQL database
agor db migrate

# 4. Import sessions/worktrees
agor import backup.json
```

**Option 2: Direct Migration (Future)**

```bash
agor db migrate-to-postgres \
  --source ~/.agor/agor.db \
  --target postgresql://user:pass@host/db
```

### For New Users

During `agor init`:

```bash
? Which database do you want to use?
  > SQLite (embedded, single file)
    PostgreSQL (production, cloud-ready)

# If PostgreSQL selected:
? PostgreSQL connection URL: postgresql://user:pass@host:port/db
? Enable SSL? (Y/n): Y
```

---

## Performance Considerations

### SQLite Advantages

- ✅ Faster for single-user, read-heavy workloads
- ✅ Zero network latency
- ✅ Simple backups (copy file)
- ✅ No connection pool overhead

### PostgreSQL Advantages

- ✅ Better concurrent writes (MVCC)
- ✅ Connection pooling for many clients
- ✅ Full-text search (tsvector, tsquery)
- ✅ JSONB operators for complex queries
- ✅ Better transaction isolation

### Benchmarks (TODO)

Test scenario: 10 concurrent sessions, 1000 messages each

- SQLite: ? ops/sec
- PostgreSQL: ? ops/sec

---

## Risks & Mitigations

### Risk 1: Schema Drift

**Risk**: SQLite and PostgreSQL schemas diverge over time

**Mitigation**:

- Single source of truth (`schema.ts`)
- CI checks for schema parity
- Integration tests for both dialects

### Risk 2: Migration Failures

**Risk**: Migration works on SQLite but fails on PostgreSQL

**Mitigation**:

- Test migrations on both dialects before release
- Automated tests in CI (SQLite + PostgreSQL containers)
- Rollback mechanism for failed migrations

### Risk 3: Type Mismatches

**Risk**: Data stored in SQLite doesn't match PostgreSQL types

**Mitigation**:

- Use Drizzle's type inference
- Validate data types during import
- Document known incompatibilities

### Risk 4: Performance Regression

**Risk**: PostgreSQL slower for single-user workloads

**Mitigation**:

- Keep SQLite as default for local development
- Document performance trade-offs
- Optimize PostgreSQL queries (indexes, connection pooling)

---

## Future Enhancements

### Phase 8+: Advanced Features

1. **Read Replicas** (PostgreSQL only)
   - Read-heavy queries routed to replicas
   - Write queries to primary

2. **Full-Text Search** (PostgreSQL only)
   - Index message content with tsvector
   - Fast search across conversations

3. **JSONB Operators** (PostgreSQL only)
   - Query nested JSON data efficiently
   - Filter by custom context fields

4. **Horizontal Sharding** (PostgreSQL only)
   - Partition worktrees by repo/board
   - Scale beyond single database

5. **MySQL Support** (Future)
   - Add third dialect option
   - Similar approach as PostgreSQL

---

## Success Criteria

### Functional Requirements

- ✅ SQLite works exactly as before (backwards compatibility)
- ✅ PostgreSQL works with all features (sessions, tasks, messages, boards)
- ✅ Single codebase supports both dialects
- ✅ Configuration switchable via config.yaml
- ✅ Migrations work for both dialects
- ✅ CLI commands work with both databases

### Non-Functional Requirements

- ✅ No performance regression for SQLite users
- ✅ PostgreSQL performance acceptable for multi-user teams
- ✅ Migration from SQLite to PostgreSQL supported
- ✅ Documentation complete for both setups
- ✅ Integration tests pass for both dialects

---

## Timeline Estimate

| Phase                                    | Effort      | Dependencies |
| ---------------------------------------- | ----------- | ------------ |
| 1. Configuration & Types                 | 1 day       | None         |
| 2. Schema Abstraction                    | 2 days      | Phase 1      |
| 3. Client Factory                        | 1 day       | Phase 2      |
| 4. Migration System (TypeScript builder) | 7 days      | Phase 2, 3   |
| 5. CLI Commands                          | 1 day       | Phase 4      |
| 6. Documentation                         | 1 day       | All phases   |
| 7. Testing & Validation                  | 2 days      | All phases   |
| **Total**                                | **15 days** | -            |

**Note**: Timeline assumes single developer, full-time focus.

**Updated Estimate Rationale**:

- Phase 4 increased from 3 → 7 days due to TypeScript migration builder
- Building utilities, converting 11 migrations, testing compilation
- See `postgres-migration-strategy.md` for detailed Phase 4 breakdown

---

## References

### Core Documentation

- [Drizzle ORM - PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new)
- [Drizzle ORM - SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations)
- [PostgreSQL vs SQLite](https://www.sqlite.org/whentouse.html)
- [Postgres.js Documentation](https://github.com/porsager/postgres)

### Related Design Docs

- **[postgres-migration-strategy.md](./postgres-migration-strategy.md)** - DRY migration system with TypeScript builder

---

## Open Questions

1. **Migration folder strategy**: Separate folders (`drizzle.sqlite/`, `drizzle.postgresql/`) or conditional logic?
   - **Recommendation**: Separate folders (cleaner, Drizzle-native)

2. **Default dialect for new users**: SQLite or PostgreSQL?
   - **Recommendation**: SQLite (simpler onboarding, matches current behavior)

3. **Data migration tool**: Build custom or use third-party (pgloader)?
   - **Recommendation**: Custom JSON export/import (cross-database compatible)

4. **Connection pooling library**: postgres.js or pg + pg-pool?
   - **Recommendation**: postgres.js (faster, better TypeScript support)

5. **Schema versioning**: How to handle schema differences between dialects?
   - **Recommendation**: Single schema with conditional types, enforce parity via tests

---

**Next Steps**:

1. Review this design document with team
2. Approve configuration schema
3. Start Phase 1 implementation
4. Set up PostgreSQL test environment (Docker)
