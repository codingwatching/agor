-- Migration: Add missing task statuses to CHECK constraint
-- Date: 2025-10-21
-- Issue: Database was created with old schema missing 'stopping', 'awaiting_permission', 'stopped'
--
-- Background:
-- The TypeScript schema in schema.ts was updated to include new task statuses, but existing
-- databases still have the old CHECK constraint that only allowed: created, running, completed, failed
--
-- This migration adds: stopping, awaiting_permission, stopped

-- SQLite doesn't support ALTER TABLE ... DROP CONSTRAINT, so we need to recreate the table

-- Step 1: Create new tasks table with correct CHECK constraint
CREATE TABLE tasks_new (
  task_id TEXT(36) PRIMARY KEY,
  session_id TEXT(36) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL CHECK(status IN ('created', 'running', 'stopping', 'awaiting_permission', 'completed', 'failed', 'stopped')),
  created_by TEXT(36) NOT NULL DEFAULT 'anonymous',
  data TEXT NOT NULL
);

-- Step 2: Copy data from old table to new table
INSERT INTO tasks_new SELECT * FROM tasks;

-- Step 3: Drop old table
DROP TABLE tasks;

-- Step 4: Rename new table to original name
ALTER TABLE tasks_new RENAME TO tasks;

-- Verification query (run after migration):
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks';
