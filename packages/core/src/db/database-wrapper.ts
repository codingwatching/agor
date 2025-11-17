/**
 * Database Wrapper with Unified Query API
 *
 * Provides a unified, dialect-agnostic API for database operations.
 * All dialect differences are handled internally, so repository code
 * can use a single consistent interface for both SQLite and PostgreSQL.
 *
 * Key Pattern: Instead of writing:
 *   const row = isSQLiteDatabase(db) ? await query.get() : (await query)[0];
 *
 * Simply write:
 *   const row = await db.execute(query).one();
 *
 * This wrapper returns augmented query builders with unified execution methods.
 */

import type { SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as sqliteSchema from './schema.sqlite';
import type * as postgresSchema from './schema.postgres';
import type { Database } from './client';

/**
 * Unified query executor with dialect-aware methods
 */
export interface UnifiedQuery<T = any> {
  /** Get a single row (returns null if not found) */
  one(): Promise<T | null>;
  /** Get all rows */
  all(): Promise<T[]>;
  /** Execute mutation (INSERT/UPDATE/DELETE) and return result */
  run(): Promise<any>;
  /** Get first row from .returning() clause */
  returning(): UnifiedReturning<T>;
}

/**
 * Unified returning clause handler
 */
export interface UnifiedReturning<T = any> {
  /** Get first returned row */
  one(): Promise<T>;
  /** Get all returned rows */
  all(): Promise<T[]>;
}

/**
 * Type guard to check if database is SQLite
 */
export function isSQLiteDatabase(
  db: Database
): db is LibSQLDatabase<typeof sqliteSchema> {
  // Check for SQLite-specific method
  return 'run' in db && typeof (db as any).run === 'function';
}

/**
 * Type guard to check if database is PostgreSQL
 */
export function isPostgresDatabase(
  db: Database
): db is PostgresJsDatabase<typeof postgresSchema> {
  // PostgreSQL doesn't have .run() method
  return !('run' in db);
}

/**
 * Execute a raw SQL query on any database
 */
export async function executeRaw(db: Database, query: SQL): Promise<any> {
  if (isSQLiteDatabase(db)) {
    return await db.run(query);
  } else {
    // PostgreSQL uses execute for raw SQL
    return await db.execute(query);
  }
}

/**
 * Get a single row from a table
 * Works for both SQLite and PostgreSQL
 */
export async function getOne<T extends SQLiteTable | PgTable>(
  db: Database,
  table: T,
  where?: SQL
): Promise<any> {
  if (isSQLiteDatabase(db)) {
    const query = db.select().from(table as any);
    if (where) {
      return await (query as any).where(where).get();
    }
    return await (query as any).get();
  } else {
    const query = (db as any).select().from(table);
    if (where) {
      const results = await query.where(where).limit(1);
      return results[0] || null;
    }
    const results = await query.limit(1);
    return results[0] || null;
  }
}

/**
 * Insert a row into a table
 * Works for both SQLite and PostgreSQL
 */
export async function insertOne<T extends SQLiteTable | PgTable>(
  db: Database,
  table: T,
  values: any
): Promise<any> {
  if (isSQLiteDatabase(db)) {
    return await db.insert(table as any).values(values).returning();
  } else {
    const result = await (db as any).insert(table).values(values).returning();
    return result[0];
  }
}

/**
 * Wrap a query with unified execution methods
 */
function wrapQuery(query: any, db: Database): any {
  return {
    ...query,
    one: async () => {
      if (isSQLiteDatabase(db)) {
        return await query.get();
      } else {
        // For PostgreSQL, add .limit(1) and execute the query
        const results = await query.limit(1);
        return results[0] || null;
      }
    },
    all: async () => {
      if (isSQLiteDatabase(db)) {
        return await query.all();
      } else {
        // For PostgreSQL, just await the query (it's a promise)
        return await query;
      }
    },
    run: async () => {
      if (isSQLiteDatabase(db)) {
        return await query.run();
      } else {
        // For PostgreSQL, execute and return result metadata
        const result = await query;
        return { rowsAffected: result.length || 0 };
      }
    },
    returning: () => wrapReturning(query.returning(), db),
    // Preserve chainable methods
    where: (...args: any[]) => wrapQuery(query.where(...args), db),
    limit: (...args: any[]) => wrapQuery(query.limit(...args), db),
    offset: (...args: any[]) => wrapQuery(query.offset(...args), db),
    orderBy: (...args: any[]) => wrapQuery(query.orderBy(...args), db),
    set: (...args: any[]) => wrapQuery(query.set(...args), db),
    values: (...args: any[]) => wrapQuery(query.values(...args), db),
  };
}

/**
 * Wrap a .returning() clause with unified execution methods
 */
function wrapReturning(query: any, db: Database): UnifiedReturning {
  return {
    one: async () => {
      if (isSQLiteDatabase(db)) {
        return await query.get();
      } else {
        const results = await query;
        return results[0];
      }
    },
    all: async () => {
      if (isSQLiteDatabase(db)) {
        return await query.all();
      } else {
        return await query;
      }
    },
  };
}

/**
 * Select from a table
 * Returns a wrapped query builder with unified execution methods
 */
export function select(db: Database) {
  const query = (db as any).select();
  return {
    ...query,
    from: (table: any) => wrapQuery(query.from(table), db),
  };
}

/**
 * Insert into a table
 * Returns a wrapped insert builder with unified execution methods
 */
export function insert(db: Database, table: any) {
  const query = (db as any).insert(table);
  return wrapQuery(query, db);
}

/**
 * Update a table
 * Returns a wrapped update builder with unified execution methods
 */
export function update(db: Database, table: any) {
  const query = (db as any).update(table);
  return wrapQuery(query, db);
}

/**
 * Delete from a table
 * Returns a wrapped delete builder with unified execution methods
 */
export function deleteFrom(db: Database, table: any) {
  const query = (db as any).delete(table);
  return wrapQuery(query, db);
}

/**
 * Execute a query and get a single result
 * Dialect-aware wrapper for .get()
 */
export async function executeGet(query: any, db: Database): Promise<any> {
  if (isSQLiteDatabase(db)) {
    return await query.get();
  } else {
    const results = await query.limit(1);
    return results[0] || null;
  }
}

/**
 * Execute a query and get all results
 * Dialect-aware wrapper for .all()
 */
export async function executeAll(query: any, db: Database): Promise<any[]> {
  if (isSQLiteDatabase(db)) {
    return await query.all();
  } else {
    return await query;
  }
}

/**
 * Execute a mutation query (INSERT/UPDATE/DELETE)
 * Dialect-aware wrapper for .run()
 */
export async function executeRun(query: any, db: Database): Promise<any> {
  if (isSQLiteDatabase(db)) {
    return await query.run();
  } else {
    // PostgreSQL: Just execute the query
    return await query;
  }
}
