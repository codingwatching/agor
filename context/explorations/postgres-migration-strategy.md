# PostgreSQL Migration Strategy: DRY Templates vs Duplication

**Status**: 🔍 Analysis
**Decision**: Template-based migrations with dialect utilities
**Related**: postgres-support.md

---

## Executive Summary

**Recommendation**: Use **TypeScript-based migration templates** with small dialect-specific utilities rather than duplicating SQL files.

**Rationale**:

- 90%+ of migration logic is identical across dialects
- Type safety catches errors at compile time
- DRY principle reduces maintenance burden
- Utilities abstract dialect quirks cleanly
- Easier to review diffs (one PR, not two separate SQL files)

---

## Current Migration Patterns Analysis

### Migration Types by Complexity

| Migration | Type                      | Lines | Complexity                     |
| --------- | ------------------------- | ----- | ------------------------------ |
| 0000      | Initial schema            | 196   | High (11 tables, indexes, FKs) |
| 0001      | Add column                | 1     | Trivial                        |
| 0002      | Add columns + indexes     | 9     | Simple                         |
| 0003      | Table recreation (SQLite) | 37    | Medium (PRAGMA, temp table)    |
| 0004      | Table recreation (SQLite) | 64    | Medium (PRAGMA, temp table)    |
| 0005      | Add columns + index       | 3     | Simple                         |
| 0008      | Add column                | 1     | Trivial                        |
| 0009      | Table recreation (SQLite) | 112   | High (2 tables, PRAGMA)        |
| 0010      | Add columns               | 6     | Simple                         |

**Breakdown**:

- 50% trivial/simple (just `ALTER TABLE ADD COLUMN`)
- 30% table recreation (SQLite-specific, PostgreSQL uses `ALTER TABLE`)
- 20% initial schema (CREATE TABLE)

### Dialect Differences Catalog

#### 1. **Backticks vs No Backticks**

**SQLite**:

```sql
ALTER TABLE `sessions` ADD `ready_for_prompt` integer DEFAULT 0 NOT NULL;
CREATE INDEX `sessions_status_idx` ON `sessions` (`status`);
```

**PostgreSQL**:

```sql
ALTER TABLE sessions ADD ready_for_prompt BOOLEAN DEFAULT false NOT NULL;
CREATE INDEX sessions_status_idx ON sessions (status);
```

**Difference**: SQLite uses backticks for identifiers, PostgreSQL uses plain identifiers.

---

#### 2. **Boolean Type**

**SQLite**:

```sql
`resolved` integer DEFAULT false NOT NULL
```

**PostgreSQL**:

```sql
resolved BOOLEAN DEFAULT false NOT NULL
```

**Difference**: SQLite uses `integer` with mode, PostgreSQL has native `BOOLEAN`.

---

#### 3. **Timestamp Type**

**SQLite**:

```sql
`created_at` integer NOT NULL  -- milliseconds since epoch
```

**PostgreSQL**:

```sql
created_at BIGINT NOT NULL  -- milliseconds since epoch (for compatibility)
-- OR
created_at TIMESTAMP WITH TIME ZONE NOT NULL  -- native timestamp
```

**Difference**: Both can use integers for Unix timestamps, or PostgreSQL can use native `TIMESTAMP`.

**Decision**: Use `BIGINT` for PostgreSQL to maintain compatibility with existing data.

---

#### 4. **JSON Type**

**SQLite**:

```sql
`data` text NOT NULL
`reactions` text DEFAULT '[]' NOT NULL
```

**PostgreSQL**:

```sql
data JSONB NOT NULL
reactions JSONB DEFAULT '[]' NOT NULL
```

**Difference**: SQLite uses `text`, PostgreSQL uses `JSONB` (binary JSON).

---

#### 5. **Text/Varchar Type**

**SQLite**:

```sql
`session_id` text(36) PRIMARY KEY NOT NULL
`content` text NOT NULL
```

**PostgreSQL**:

```sql
session_id VARCHAR(36) PRIMARY KEY NOT NULL
content TEXT NOT NULL
```

**Difference**: SQLite uses `text(length)`, PostgreSQL uses `VARCHAR(length)` for limited, `TEXT` for unlimited.

---

#### 6. **Foreign Keys**

**SQLite**:

```sql
FOREIGN KEY (`board_id`) REFERENCES `boards`(`board_id`) ON UPDATE no action ON DELETE cascade
```

**PostgreSQL**:

```sql
FOREIGN KEY (board_id) REFERENCES boards(board_id) ON UPDATE NO ACTION ON DELETE CASCADE
```

**Difference**: Casing (`no action` vs `NO ACTION`) and backticks.

---

#### 7. **PRAGMA Statements**

**SQLite**:

```sql
PRAGMA foreign_keys=OFF;
-- ... table recreation
PRAGMA foreign_keys=ON;
```

**PostgreSQL**:

```sql
-- Not needed (transactional DDL)
```

**Difference**: SQLite requires PRAGMA for safe table recreation, PostgreSQL doesn't.

---

#### 8. **Table Recreation (ALTER COLUMN)**

**SQLite** (no ALTER COLUMN support):

```sql
PRAGMA foreign_keys=OFF;

CREATE TABLE sessions_new (
  session_id text(36) PRIMARY KEY NOT NULL,
  -- ... all columns with new schema
);

INSERT INTO sessions_new (session_id, ...)
SELECT session_id, ... FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

PRAGMA foreign_keys=ON;

-- Recreate indexes
CREATE INDEX sessions_status_idx ON sessions (status);
```

**PostgreSQL**:

```sql
ALTER TABLE sessions ADD COLUMN ready_for_prompt BOOLEAN DEFAULT false NOT NULL;
-- No table recreation needed
```

**Difference**: Massive (37-112 lines for SQLite vs 1 line for PostgreSQL).

---

#### 9. **Default Values**

**SQLite**:

```sql
`created_by` text(36) DEFAULT 'anonymous' NOT NULL
`enabled` integer DEFAULT true NOT NULL  -- boolean as integer
```

**PostgreSQL**:

```sql
created_by VARCHAR(36) DEFAULT 'anonymous' NOT NULL
enabled BOOLEAN DEFAULT true NOT NULL
```

**Difference**: Boolean defaults are `true`/`false` in PostgreSQL vs `integer` in SQLite.

---

#### 10. **Auto-increment**

**SQLite**:

```sql
CREATE TABLE __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

**PostgreSQL**:

```sql
CREATE TABLE __drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
```

**Difference**: `AUTOINCREMENT` vs `SERIAL`.

---

## Migration Patterns by Category

### Category A: Simple ADD COLUMN (50% of migrations)

**Examples**: 0001, 0002, 0005, 0008, 0010

**SQLite**:

```sql
ALTER TABLE `messages` ADD `parent_tool_use_id` text;
ALTER TABLE `sessions` ADD `scheduled_run_at` integer;
```

**PostgreSQL**:

```sql
ALTER TABLE messages ADD parent_tool_use_id TEXT;
ALTER TABLE sessions ADD scheduled_run_at BIGINT;
```

**Differences**:

- ✅ Backticks removal (easy)
- ✅ Type mapping (`integer` → `BIGINT`, `text` → `TEXT/VARCHAR`)
- ✅ Identical structure

**Complexity**: Low (mechanical transformation)

---

### Category B: CREATE INDEX (20% of migrations)

**SQLite**:

```sql
CREATE INDEX `sessions_status_idx` ON `sessions` (`status`);
CREATE INDEX `worktrees_board_schedule_idx` ON `worktrees` (`board_id`,`schedule_enabled`);
```

**PostgreSQL**:

```sql
CREATE INDEX sessions_status_idx ON sessions (status);
CREATE INDEX worktrees_board_schedule_idx ON worktrees (board_id, schedule_enabled);
```

**Differences**:

- ✅ Backticks removal
- ✅ Identical structure

**Complexity**: Low (mechanical transformation)

---

### Category C: CREATE TABLE (20% of migrations)

**SQLite** (from 0000):

```sql
CREATE TABLE `sessions` (
	`session_id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`status` text NOT NULL,
	`ready_for_prompt` integer DEFAULT false NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);
```

**PostgreSQL**:

```sql
CREATE TABLE sessions (
	session_id VARCHAR(36) PRIMARY KEY NOT NULL,
	created_at BIGINT NOT NULL,
	status TEXT NOT NULL,
	ready_for_prompt BOOLEAN DEFAULT false NOT NULL,
	data JSONB NOT NULL,
	FOREIGN KEY (worktree_id) REFERENCES worktrees(worktree_id) ON UPDATE NO ACTION ON DELETE CASCADE
);
```

**Differences**:

- ✅ Backticks removal
- ✅ Type mapping (`integer` → `BIGINT`, `text` → `TEXT/VARCHAR/JSONB`, `integer DEFAULT false` → `BOOLEAN DEFAULT false`)
- ✅ FK casing (`no action` → `NO ACTION`)
- ✅ Identical structure

**Complexity**: Medium (type mapping required)

---

### Category D: Table Recreation (10% of migrations, SQLite-only)

**Examples**: 0003, 0004, 0009

**SQLite** (from 0009):

```sql
PRAGMA foreign_keys=OFF;

CREATE TABLE `sessions_new` (
  `session_id` text(36) PRIMARY KEY NOT NULL,
  -- ... 20+ columns
  FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`worktree_id`) ON UPDATE no action ON DELETE cascade
);

INSERT INTO `sessions_new` (session_id, created_at, ...)
SELECT session_id, created_at, ... FROM `sessions`;

DROP TABLE `sessions`;
ALTER TABLE `sessions_new` RENAME TO `sessions`;

PRAGMA foreign_keys=ON;

CREATE INDEX `sessions_status_idx` ON `sessions` (`status`);
-- ... 5+ more indexes
```

**PostgreSQL** (equivalent):

```sql
ALTER TABLE sessions ADD COLUMN ready_for_prompt BOOLEAN DEFAULT false NOT NULL;
```

**Differences**:

- 🔴 **Completely different approach**
- SQLite: 37-112 lines of table recreation
- PostgreSQL: 1-5 lines of `ALTER TABLE`

**Complexity**: High (requires migration template logic)

---

## Design Options

### Option 1: Duplicate SQL Files (Status Quo)

**Structure**:

```
packages/core/
├── drizzle.sqlite/
│   ├── 0000_pretty_mac_gargan.sql (196 lines)
│   ├── 0001_organic_stick.sql (1 line)
│   └── meta/
└── drizzle.postgresql/
    ├── 0000_initial_schema.sql (196 lines, 90% identical)
    ├── 0001_add_parent_tool_use_id.sql (1 line, 90% identical)
    └── meta/
```

**Pros**:

- ✅ Simple (Drizzle's native approach)
- ✅ No custom tooling needed
- ✅ SQL is directly inspectable

**Cons**:

- ❌ Massive duplication (90%+ identical code)
- ❌ Double maintenance burden (change = 2 PRs)
- ❌ Drift risk (SQLite gets fix, PostgreSQL doesn't)
- ❌ Harder to review (need to diff both files)
- ❌ No type safety (SQL strings)

**Verdict**: ❌ **Rejected** - violates DRY, high maintenance burden

---

### Option 2: Template SQL Files

**Structure**:

```
packages/core/
├── drizzle.templates/
│   ├── 0000_initial_schema.sql.hbs
│   └── 0001_add_column.sql.hbs
├── scripts/
│   └── generate-migrations.ts
└── drizzle.sqlite/     # Generated
└── drizzle.postgresql/ # Generated
```

**Example template**:

```sql
-- 0001_add_column.sql.hbs
ALTER TABLE {{#if postgres}}sessions{{else}}`sessions`{{/if}}
ADD {{#if postgres}}parent_tool_use_id TEXT{{else}}`parent_tool_use_id` text{{/if}};
```

**Pros**:

- ✅ Single source of truth
- ✅ No duplication

**Cons**:

- ❌ Handlebars in SQL (ugly, hard to read)
- ❌ Complex templates for table recreation
- ❌ No type safety
- ❌ Hard to debug generated SQL
- ❌ Extra build step

**Verdict**: ❌ **Rejected** - templates too complex for SQL

---

### Option 3: TypeScript Migration Builder (Recommended)

**Structure**:

```
packages/core/
├── src/db/migrations/
│   ├── 0000-initial-schema.ts
│   ├── 0001-add-parent-tool-use-id.ts
│   ├── utils/
│   │   ├── migration-builder.ts
│   │   ├── types.ts
│   │   └── dialect-utils.ts
│   └── index.ts
├── scripts/
│   └── compile-migrations.ts
└── drizzle.sqlite/     # Generated from TS
└── drizzle.postgresql/ # Generated from TS
```

**Example migration (TypeScript)**:

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

**Pros**:

- ✅ Single source of truth (TypeScript)
- ✅ Type safety (catches errors at compile time)
- ✅ DRY utilities abstract dialect quirks
- ✅ Easy to review (one file, not two)
- ✅ Programmatic (can generate complex migrations)
- ✅ Testable (unit tests for migration logic)

**Cons**:

- ⚠️ Custom tooling (migration builder)
- ⚠️ Extra compile step (but automated)
- ⚠️ Learning curve (new API)

**Verdict**: ✅ **RECOMMENDED** - best balance of DRY + type safety

---

### Option 4: Drizzle Schema-Based (Future)

**Approach**: Let Drizzle generate migrations from schema changes

**Pros**:

- ✅ No manual migrations
- ✅ Drizzle handles dialect differences

**Cons**:

- ❌ Not ready for production (Drizzle's diffing is experimental)
- ❌ Can't handle data migrations
- ❌ Lost in complex scenarios (table recreation)

**Verdict**: ⏸️ **Deferred** - wait for Drizzle maturity

---

## Recommended Approach: TypeScript Migration Builder

### Architecture

```typescript
// packages/core/src/db/migrations/utils/types.ts

export type Dialect = 'sqlite' | 'postgresql';

export interface ColumnDef {
  name: string;
  type: 'text' | 'integer' | 'boolean' | 'json' | 'timestamp';
  length?: number;
  nullable?: boolean;
  default?: string | number | boolean;
  primaryKey?: boolean;
}

export interface IndexDef {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
}

export interface ForeignKeyDef {
  table: string;
  column: string;
  references: {
    table: string;
    column: string;
  };
  onDelete?: 'cascade' | 'set null' | 'restrict';
  onUpdate?: 'cascade' | 'set null' | 'restrict';
}

export interface MigrationBuilder {
  // DDL operations
  createTable(
    name: string,
    schema: {
      columns: ColumnDef[];
      foreignKeys?: ForeignKeyDef[];
    }
  ): void;

  addColumn(table: string, column: ColumnDef): void;

  dropColumn(table: string, column: string): void;

  alterColumn(table: string, column: string, changes: Partial<ColumnDef>): void;

  createIndex(index: IndexDef): void;

  dropIndex(name: string): void;

  addForeignKey(fk: ForeignKeyDef): void;

  dropForeignKey(table: string, column: string): void;

  // Raw SQL (for dialect-specific operations)
  raw(sql: string, dialectOverride?: Dialect): void;
}

export interface Migration {
  name: string;
  up: (builder: MigrationBuilder) => void;
  down?: (builder: MigrationBuilder) => void;
}
```

---

### Dialect Utilities

```typescript
// packages/core/src/db/migrations/utils/dialect-utils.ts

export class DialectUtils {
  constructor(private dialect: Dialect) {}

  /** Quote identifier (table/column name) */
  quote(name: string): string {
    return this.dialect === 'sqlite' ? `\`${name}\`` : name;
  }

  /** Map abstract type to SQL type */
  mapType(type: string, length?: number): string {
    if (this.dialect === 'postgresql') {
      switch (type) {
        case 'text':
          return length ? `VARCHAR(${length})` : 'TEXT';
        case 'integer':
          return 'BIGINT';
        case 'boolean':
          return 'BOOLEAN';
        case 'json':
          return 'JSONB';
        case 'timestamp':
          return 'TIMESTAMP WITH TIME ZONE';
        default:
          return type.toUpperCase();
      }
    }

    // SQLite
    switch (type) {
      case 'text':
        return length ? `text(${length})` : 'text';
      case 'integer':
        return 'integer';
      case 'boolean':
        return 'integer'; // Will use mode: 'boolean' in schema
      case 'json':
        return 'text'; // Will use mode: 'json' in schema
      case 'timestamp':
        return 'integer'; // Will use mode: 'timestamp_ms' in schema
      default:
        return type;
    }
  }

  /** Format default value */
  formatDefault(value: string | number | boolean, type: string): string {
    if (type === 'boolean' && this.dialect === 'postgresql') {
      return String(value);
    }
    if (type === 'boolean' && this.dialect === 'sqlite') {
      return value ? '1' : '0';
    }
    if (typeof value === 'string') {
      return `'${value}'`;
    }
    return String(value);
  }

  /** Format foreign key action */
  formatAction(action?: string): string {
    if (!action) return 'NO ACTION';
    return this.dialect === 'postgresql' ? action.toUpperCase() : action.toLowerCase();
  }

  /** Check if dialect supports ALTER COLUMN */
  supportsAlterColumn(): boolean {
    return this.dialect === 'postgresql';
  }

  /** Check if dialect needs PRAGMA */
  needsPragma(): boolean {
    return this.dialect === 'sqlite';
  }
}
```

---

### Migration Builder Implementation

```typescript
// packages/core/src/db/migrations/utils/migration-builder.ts

export class MigrationBuilderImpl implements MigrationBuilder {
  private statements: string[] = [];
  private utils: DialectUtils;

  constructor(private dialect: Dialect) {
    this.utils = new DialectUtils(dialect);
  }

  addColumn(table: string, column: ColumnDef): void {
    const quotedTable = this.utils.quote(table);
    const quotedColumn = this.utils.quote(column.name);
    const sqlType = this.utils.mapType(column.type, column.length);
    const nullable = column.nullable ? '' : ' NOT NULL';
    const defaultVal = column.default
      ? ` DEFAULT ${this.utils.formatDefault(column.default, column.type)}`
      : '';

    this.statements.push(
      `ALTER TABLE ${quotedTable} ADD ${quotedColumn} ${sqlType}${defaultVal}${nullable};`
    );
  }

  createIndex(index: IndexDef): void {
    const quotedName = this.utils.quote(index.name);
    const quotedTable = this.utils.quote(index.table);
    const quotedColumns = index.columns.map(c => this.utils.quote(c)).join(',');
    const unique = index.unique ? 'UNIQUE ' : '';

    this.statements.push(
      `CREATE ${unique}INDEX ${quotedName} ON ${quotedTable} (${quotedColumns});`
    );
  }

  alterColumn(table: string, column: string, changes: Partial<ColumnDef>): void {
    if (!this.utils.supportsAlterColumn()) {
      throw new Error('SQLite does not support ALTER COLUMN. Use table recreation instead.');
    }

    // PostgreSQL only
    const quotedTable = this.utils.quote(table);
    const quotedColumn = this.utils.quote(column);

    if (changes.type) {
      const sqlType = this.utils.mapType(changes.type, changes.length);
      this.statements.push(
        `ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} TYPE ${sqlType};`
      );
    }

    if (changes.default !== undefined) {
      const defaultVal = this.utils.formatDefault(changes.default, changes.type!);
      this.statements.push(
        `ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} SET DEFAULT ${defaultVal};`
      );
    }

    if (changes.nullable !== undefined) {
      const action = changes.nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
      this.statements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} ${action};`);
    }
  }

  // ... more operations (createTable, addForeignKey, etc.)

  toSQL(): string {
    return this.statements.join('\n');
  }
}

export function createMigration(migration: Migration): Migration {
  return migration;
}
```

---

### Example Migrations

#### Simple Migration (0001)

```typescript
// packages/core/src/db/migrations/0001-add-parent-tool-use-id.ts

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
  down: m => {
    m.dropColumn('messages', 'parent_tool_use_id');
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

---

#### Complex Migration (0009 - Table Recreation)

```typescript
// packages/core/src/db/migrations/0009-add-ready-for-prompt.ts

import { createMigration } from './utils/migration-builder';
import { recreateTable } from './utils/sqlite-helpers';

export default createMigration({
  name: '0009_add_ready_for_prompt',
  up: m => {
    if (m.dialect === 'postgresql') {
      // Simple ALTER TABLE for PostgreSQL
      m.addColumn('sessions', {
        name: 'ready_for_prompt',
        type: 'boolean',
        default: false,
        nullable: false,
      });
    } else {
      // Table recreation for SQLite
      recreateTable(m, {
        table: 'sessions',
        newColumns: [
          {
            name: 'ready_for_prompt',
            type: 'boolean',
            default: false,
            nullable: false,
          },
        ],
        existingColumns: [
          'session_id',
          'created_at',
          'updated_at',
          'created_by',
          'status',
          'agentic_tool',
          'board_id',
          'parent_session_id',
          'forked_from_session_id',
          'worktree_id',
          'scheduled_run_at',
          'scheduled_from_worktree',
          'data',
        ],
        indexes: [
          { name: 'sessions_status_idx', columns: ['status'] },
          { name: 'sessions_worktree_idx', columns: ['worktree_id'] },
          // ... more indexes
        ],
        foreignKeys: [
          {
            column: 'worktree_id',
            references: { table: 'worktrees', column: 'worktree_id' },
            onDelete: 'cascade',
          },
        ],
      });
    }
  },
});
```

**Generated SQLite** (37+ lines):

```sql
PRAGMA foreign_keys=OFF;

CREATE TABLE `sessions_new` (
  `session_id` text(36) PRIMARY KEY NOT NULL,
  -- ... all columns
  `ready_for_prompt` integer DEFAULT 0 NOT NULL
);

INSERT INTO `sessions_new` (...)
SELECT ... FROM `sessions`;

DROP TABLE `sessions`;
ALTER TABLE `sessions_new` RENAME TO `sessions`;

PRAGMA foreign_keys=ON;

CREATE INDEX `sessions_status_idx` ON `sessions` (`status`);
-- ... more indexes
```

**Generated PostgreSQL** (1 line):

```sql
ALTER TABLE sessions ADD ready_for_prompt BOOLEAN DEFAULT false NOT NULL;
```

---

#### Initial Schema Migration (0000)

```typescript
// packages/core/src/db/migrations/0000-initial-schema.ts

import { createMigration } from './utils/migration-builder';

export default createMigration({
  name: '0000_initial_schema',
  up: m => {
    // Boards table
    m.createTable('boards', {
      columns: [
        { name: 'board_id', type: 'text', length: 36, primaryKey: true },
        { name: 'created_at', type: 'timestamp', nullable: false },
        { name: 'updated_at', type: 'timestamp', nullable: true },
        { name: 'created_by', type: 'text', length: 36, default: 'anonymous', nullable: false },
        { name: 'name', type: 'text', nullable: false },
        { name: 'slug', type: 'text', nullable: true },
        { name: 'data', type: 'json', nullable: false },
      ],
    });

    m.createIndex({ name: 'boards_name_idx', table: 'boards', columns: ['name'] });
    m.createIndex({ name: 'boards_slug_unique', table: 'boards', columns: ['slug'], unique: true });

    // Sessions table
    m.createTable('sessions', {
      columns: [
        { name: 'session_id', type: 'text', length: 36, primaryKey: true },
        { name: 'created_at', type: 'timestamp', nullable: false },
        { name: 'status', type: 'text', nullable: false },
        { name: 'worktree_id', type: 'text', length: 36, nullable: false },
        { name: 'data', type: 'json', nullable: false },
      ],
      foreignKeys: [
        {
          column: 'worktree_id',
          references: { table: 'worktrees', column: 'worktree_id' },
          onDelete: 'cascade',
        },
      ],
    });

    m.createIndex({ name: 'sessions_status_idx', table: 'sessions', columns: ['status'] });

    // ... 9 more tables
  },
});
```

---

### SQLite-Specific Helpers

```typescript
// packages/core/src/db/migrations/utils/sqlite-helpers.ts

interface TableRecreationConfig {
  table: string;
  newColumns: ColumnDef[];
  existingColumns: string[];
  indexes: IndexDef[];
  foreignKeys?: ForeignKeyDef[];
}

export function recreateTable(m: MigrationBuilder, config: TableRecreationConfig): void {
  const { table, newColumns, existingColumns, indexes, foreignKeys } = config;

  // Step 1: Disable foreign keys
  m.raw('PRAGMA foreign_keys=OFF;', 'sqlite');

  // Step 2: Create new table with all columns
  const allColumns = [...existingColumns, ...newColumns.map(c => c.name)];
  m.createTable(`${table}_new`, {
    columns: allColumns.map(name => {
      const newCol = newColumns.find(c => c.name === name);
      return (
        newCol || {
          name,
          type: 'text', // Placeholder, will be inferred from existing schema
          nullable: true,
        }
      );
    }),
    foreignKeys,
  });

  // Step 3: Copy data
  const selectColumns = existingColumns.join(', ');
  m.raw(
    `INSERT INTO \`${table}_new\` (${selectColumns}) SELECT ${selectColumns} FROM \`${table}\`;`,
    'sqlite'
  );

  // Step 4: Drop old table
  m.raw(`DROP TABLE \`${table}\`;`, 'sqlite');

  // Step 5: Rename new table
  m.raw(`ALTER TABLE \`${table}_new\` RENAME TO \`${table}\`;`, 'sqlite');

  // Step 6: Re-enable foreign keys
  m.raw('PRAGMA foreign_keys=ON;', 'sqlite');

  // Step 7: Recreate indexes
  indexes.forEach(index => m.createIndex(index));
}
```

---

### Compilation Script

```typescript
// packages/core/scripts/compile-migrations.ts

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MigrationBuilderImpl } from '../src/db/migrations/utils/migration-builder';

async function compileMigrations() {
  const migrations = [
    await import('../src/db/migrations/0000-initial-schema'),
    await import('../src/db/migrations/0001-add-parent-tool-use-id'),
    // ... more migrations
  ];

  for (const dialect of ['sqlite', 'postgresql'] as const) {
    const outDir = join(__dirname, '..', `drizzle.${dialect}`);

    for (const migration of migrations) {
      const builder = new MigrationBuilderImpl(dialect);
      migration.default.up(builder);

      const sql = builder.toSQL();
      const filename = `${migration.default.name}.sql`;
      writeFileSync(join(outDir, filename), sql);
    }

    console.log(`✅ Generated ${migrations.length} migrations for ${dialect}`);
  }
}

compileMigrations();
```

**Package.json script**:

```json
{
  "scripts": {
    "db:compile-migrations": "tsx scripts/compile-migrations.ts"
  }
}
```

---

## Decision Matrix

| Criteria               | Duplicate SQL   | Template SQL | TypeScript Builder | Drizzle Auto    |
| ---------------------- | --------------- | ------------ | ------------------ | --------------- |
| **DRY**                | ❌ 0%           | ✅ 100%      | ✅ 100%            | ✅ 100%         |
| **Type Safety**        | ❌ No           | ❌ No        | ✅ Yes             | ✅ Yes          |
| **Readability**        | ✅ High         | ⚠️ Medium    | ✅ High            | ✅ High         |
| **Maintenance**        | ❌ 2x effort    | ✅ 1x effort | ✅ 1x effort       | ✅ Minimal      |
| **Tooling Complexity** | ✅ None         | ⚠️ Medium    | ⚠️ Medium          | ✅ None         |
| **Flexibility**        | ✅ Full control | ⚠️ Limited   | ✅ Full control    | ⚠️ Limited      |
| **Production Ready**   | ✅ Yes          | ✅ Yes       | ⚠️ Custom          | ❌ Experimental |
| **Review Ease**        | ❌ 2 files      | ✅ 1 file    | ✅ 1 file          | ✅ 1 file       |
| **Debugging**          | ✅ Direct SQL   | ⚠️ Generated | ⚠️ Generated       | ⚠️ Generated    |

**Winner**: ✅ **TypeScript Builder** (best balance for production use)

---

## Implementation Plan

### Phase 1: Build Migration Utilities (2 days)

1. Create `packages/core/src/db/migrations/utils/`
2. Implement `DialectUtils` class
3. Implement `MigrationBuilderImpl` class
4. Implement `sqlite-helpers.ts` (table recreation)
5. Add unit tests for dialect utilities

### Phase 2: Migrate Existing Migrations (3 days)

1. Convert 0000 (initial schema) → TypeScript
2. Convert 0001-0010 (incremental) → TypeScript
3. Test compilation to SQL
4. Validate generated SQL matches original

### Phase 3: Update Build Process (1 day)

1. Add `compile-migrations.ts` script
2. Update CI to compile migrations before tests
3. Update developer workflow docs

### Phase 4: Validation (1 day)

1. Run compiled SQLite migrations on test database
2. Run compiled PostgreSQL migrations on test database
3. Compare schema outputs (should be identical to manual migrations)

---

## Open Questions

1. **Should we commit generated SQL files to git?**
   - **Recommendation**: Yes (easier to review, no build step for users)
   - Generated SQL committed to `drizzle.sqlite/` and `drizzle.postgresql/`
   - Source of truth is TypeScript in `src/db/migrations/`

2. **How to handle existing migrations (0000-0010)?**
   - **Option A**: Convert to TypeScript (preferred, full migration)
   - **Option B**: Keep existing as-is, use TypeScript for new migrations (hybrid)
   - **Recommendation**: Option A (clean cutover)

3. **Should we support down migrations?**
   - **Recommendation**: Yes (optional, for rollback support)
   - Not all migrations reversible (data loss)

4. **How to handle data migrations (not just DDL)?**
   - **Recommendation**: Add `m.rawQuery()` for data manipulation
   - Example: `m.rawQuery('UPDATE sessions SET status = ...')`

---

## Summary

**Recommendation**: Use **TypeScript-based migration builder** with dialect utilities.

**Key Benefits**:

- ✅ 90%+ code reuse (DRY)
- ✅ Type safety catches errors early
- ✅ Single file to review per migration
- ✅ Utilities abstract dialect quirks (`quote()`, `mapType()`, `formatDefault()`)
- ✅ Table recreation helper for SQLite
- ✅ Testable (unit tests for migration logic)

**Timeline**: 7 days total (utilities + migration conversion + validation)

**Next Steps**:

1. Review this design with team
2. Approve TypeScript builder approach
3. Start Phase 1 (build utilities)
4. Convert one migration as proof-of-concept (0001)
5. Validate approach before converting all migrations
