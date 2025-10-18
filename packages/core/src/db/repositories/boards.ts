/**
 * Board Repository
 *
 * Type-safe CRUD operations for boards with short ID support.
 */

import type { Board, BoardObject, UUID } from '@agor/core/types';
import { eq, like } from 'drizzle-orm';
import type { Database } from '../client';
import { formatShortId, generateId } from '../ids';
import { type BoardInsert, type BoardRow, boards } from '../schema';
import {
  AmbiguousIdError,
  type BaseRepository,
  EntityNotFoundError,
  RepositoryError,
} from './base';

/**
 * Board repository implementation
 */
export class BoardRepository implements BaseRepository<Board, Partial<Board>> {
  constructor(private db: Database) {}

  /**
   * Convert database row to Board type
   */
  private rowToBoard(row: BoardRow): Board {
    const data = row.data as {
      description?: string;
      sessions: string[];
      color?: string;
      icon?: string;
      layout?: Record<string, { x: number; y: number; parentId?: string }>;
      objects?: Record<string, BoardObject>;
      custom_context?: Record<string, unknown>;
    };

    return {
      board_id: row.board_id as UUID,
      name: row.name,
      slug: row.slug || undefined,
      created_at: new Date(row.created_at).toISOString(),
      last_updated: row.updated_at
        ? new Date(row.updated_at).toISOString()
        : new Date(row.created_at).toISOString(),
      created_by: row.created_by,
      ...data,
      sessions: data.sessions.map(s => s as UUID),
    };
  }

  /**
   * Convert Board to database insert format
   */
  private boardToInsert(board: Partial<Board>): BoardInsert {
    const now = Date.now();
    const boardId = board.board_id ?? generateId();

    return {
      board_id: boardId,
      name: board.name ?? 'Untitled Board',
      slug: board.slug ?? null,
      created_at: new Date(board.created_at ?? now),
      updated_at: board.last_updated ? new Date(board.last_updated) : new Date(now),
      created_by: board.created_by ?? 'anonymous',
      data: {
        description: board.description,
        sessions: board.sessions ?? [],
        color: board.color,
        icon: board.icon,
        layout: board.layout,
        objects: board.objects,
        custom_context: board.custom_context,
      },
    };
  }

  /**
   * Resolve short ID to full ID
   */
  private async resolveId(id: string): Promise<string> {
    // If already a full UUID, return as-is
    if (id.length === 36 && id.includes('-')) {
      return id;
    }

    // Short ID - need to resolve
    const normalized = id.replace(/-/g, '').toLowerCase();
    const pattern = `${normalized}%`;

    const results = await this.db
      .select({ board_id: boards.board_id })
      .from(boards)
      .where(like(boards.board_id, pattern))
      .all();

    if (results.length === 0) {
      throw new EntityNotFoundError('Board', id);
    }

    if (results.length > 1) {
      throw new AmbiguousIdError(
        'Board',
        id,
        results.map(r => formatShortId(r.board_id))
      );
    }

    return results[0].board_id;
  }

  /**
   * Create a new board
   */
  async create(data: Partial<Board>): Promise<Board> {
    try {
      const insert = this.boardToInsert(data);
      await this.db.insert(boards).values(insert);

      const row = await this.db
        .select()
        .from(boards)
        .where(eq(boards.board_id, insert.board_id))
        .get();

      if (!row) {
        throw new RepositoryError('Failed to retrieve created board');
      }

      return this.rowToBoard(row);
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError(
        `Failed to create board: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Find board by ID (supports short ID)
   */
  async findById(id: string): Promise<Board | null> {
    try {
      const fullId = await this.resolveId(id);
      const row = await this.db.select().from(boards).where(eq(boards.board_id, fullId)).get();

      return row ? this.rowToBoard(row) : null;
    } catch (error) {
      if (error instanceof EntityNotFoundError) return null;
      if (error instanceof AmbiguousIdError) throw error;
      throw new RepositoryError(
        `Failed to find board: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Find board by slug
   */
  async findBySlug(slug: string): Promise<Board | null> {
    try {
      const row = await this.db.select().from(boards).where(eq(boards.slug, slug)).get();

      return row ? this.rowToBoard(row) : null;
    } catch (error) {
      throw new RepositoryError(
        `Failed to find board by slug: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Find all boards
   */
  async findAll(): Promise<Board[]> {
    try {
      const rows = await this.db.select().from(boards).all();
      return rows.map(row => this.rowToBoard(row));
    } catch (error) {
      throw new RepositoryError(
        `Failed to find all boards: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Update board by ID
   */
  async update(id: string, updates: Partial<Board>): Promise<Board> {
    try {
      const fullId = await this.resolveId(id);

      // Get current board to merge updates
      const current = await this.findById(fullId);
      if (!current) {
        throw new EntityNotFoundError('Board', id);
      }

      const merged = { ...current, ...updates };
      const insert = this.boardToInsert(merged);

      await this.db
        .update(boards)
        .set({
          name: insert.name,
          slug: insert.slug,
          updated_at: new Date(),
          data: insert.data,
        })
        .where(eq(boards.board_id, fullId));

      const updated = await this.findById(fullId);
      if (!updated) {
        throw new RepositoryError('Failed to retrieve updated board');
      }

      return updated;
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      if (error instanceof EntityNotFoundError) throw error;
      throw new RepositoryError(
        `Failed to update board: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Delete board by ID
   */
  async delete(id: string): Promise<void> {
    try {
      const fullId = await this.resolveId(id);

      const result = await this.db.delete(boards).where(eq(boards.board_id, fullId)).run();

      if (result.rowsAffected === 0) {
        throw new EntityNotFoundError('Board', id);
      }
    } catch (error) {
      if (error instanceof EntityNotFoundError) throw error;
      throw new RepositoryError(
        `Failed to delete board: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Add session to board
   */
  async addSession(boardId: string, sessionId: string): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new EntityNotFoundError('Board', boardId);
      }

      if (!board.sessions.includes(sessionId as UUID)) {
        board.sessions.push(sessionId as UUID);
        return this.update(boardId, { sessions: board.sessions });
      }

      return board;
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      if (error instanceof EntityNotFoundError) throw error;
      throw new RepositoryError(
        `Failed to add session to board: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Remove session from board
   */
  async removeSession(boardId: string, sessionId: string): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new EntityNotFoundError('Board', boardId);
      }

      board.sessions = board.sessions.filter(id => id !== sessionId);
      return this.update(boardId, { sessions: board.sessions });
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      if (error instanceof EntityNotFoundError) throw error;
      throw new RepositoryError(
        `Failed to remove session from board: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Get default board (or create if doesn't exist)
   */
  async getDefault(): Promise<Board> {
    try {
      const defaultBoard = await this.findBySlug('default');

      if (defaultBoard) {
        return defaultBoard;
      }

      // Create default board
      return this.create({
        name: 'Default',
        slug: 'default',
        description: 'Default board for all sessions',
        color: '#1677ff',
        icon: 'star',
      });
    } catch (error) {
      throw new RepositoryError(
        `Failed to get default board: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Atomically add or update a board object (text label or zone)
   *
   * Uses read-modify-write approach with proper serialization via update() method.
   */
  async upsertBoardObject(
    boardId: string,
    objectId: string,
    objectData: BoardObject
  ): Promise<Board> {
    try {
      const fullId = await this.resolveId(boardId);

      const current = await this.findById(fullId);
      if (!current) {
        throw new EntityNotFoundError('Board', boardId);
      }

      // Add or update the object
      const updatedObjects = { ...(current.objects || {}), [objectId]: objectData };

      // Use the standard update method to ensure proper serialization
      return this.update(fullId, { objects: updatedObjects });
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      if (error instanceof EntityNotFoundError) throw error;
      throw new RepositoryError(
        `Failed to upsert board object: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Atomically remove a board object
   */
  async removeBoardObject(boardId: string, objectId: string): Promise<Board> {
    try {
      const fullId = await this.resolveId(boardId);

      const current = await this.findById(fullId);
      if (!current) {
        throw new EntityNotFoundError('Board', boardId);
      }

      // Remove the object
      const updatedObjects = { ...(current.objects || {}) };
      delete updatedObjects[objectId];

      // Use the standard update method to ensure proper serialization
      return this.update(fullId, { objects: updatedObjects });
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      if (error instanceof EntityNotFoundError) throw error;
      throw new RepositoryError(
        `Failed to remove board object: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Batch upsert multiple objects (sequential atomic updates)
   *
   * Note: Not a single transaction - each object is updated atomically.
   * This is safe for independent objects but may have partial failures.
   */
  async batchUpsertBoardObjects(
    boardId: string,
    objects: Record<string, BoardObject>
  ): Promise<Board> {
    try {
      for (const [objectId, objectData] of Object.entries(objects)) {
        await this.upsertBoardObject(boardId, objectId, objectData);
      }

      const fullId = await this.resolveId(boardId);
      const updated = await this.findById(fullId);
      if (!updated) {
        throw new RepositoryError('Failed to retrieve updated board');
      }

      return updated;
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      if (error instanceof EntityNotFoundError) throw error;
      throw new RepositoryError(
        `Failed to batch upsert board objects: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Delete a zone and handle associated sessions
   *
   * @param boardId - Board ID containing the zone
   * @param objectId - Zone object ID to delete
   * @param deleteAssociatedSessions - If true, remove sessions from board; if false, unpin them
   * @returns Updated board and list of affected session IDs
   */
  async deleteZone(
    boardId: string,
    objectId: string,
    deleteAssociatedSessions: boolean
  ): Promise<{ board: Board; affectedSessions: string[] }> {
    try {
      const fullId = await this.resolveId(boardId);
      const current = await this.findById(fullId);
      if (!current) {
        throw new EntityNotFoundError('Board', boardId);
      }

      // Check if object exists and is a zone
      const zoneObject = current.objects?.[objectId];
      if (!zoneObject) {
        throw new EntityNotFoundError('Zone', objectId);
      }
      if (zoneObject.type !== 'zone') {
        throw new RepositoryError(`Object ${objectId} is not a zone`);
      }

      // Find sessions pinned to this zone (sessions positioned within zone bounds)
      const affectedSessions: string[] = [];
      const zoneBounds = {
        x: zoneObject.x,
        y: zoneObject.y,
        width: zoneObject.width,
        height: zoneObject.height,
      };

      // Check each session's position
      for (const sessionId of current.sessions) {
        const position = current.layout?.[sessionId];
        if (position) {
          // Check if session is within zone bounds
          const isInZone =
            position.x >= zoneBounds.x &&
            position.x <= zoneBounds.x + zoneBounds.width &&
            position.y >= zoneBounds.y &&
            position.y <= zoneBounds.y + zoneBounds.height;

          if (isInZone) {
            affectedSessions.push(sessionId);
          }
        }
      }

      // Remove the zone object
      const updatedObjects = { ...(current.objects || {}) };
      delete updatedObjects[objectId];

      // Handle affected sessions
      let updatedSessions = current.sessions;
      if (deleteAssociatedSessions && affectedSessions.length > 0) {
        // Remove affected sessions from board
        updatedSessions = current.sessions.filter(id => !affectedSessions.includes(id));
      }
      // If not deleting, sessions remain on board (just unpinned from zone)

      // Update board
      const updatedBoard = await this.update(fullId, {
        objects: updatedObjects,
        sessions: updatedSessions,
      });

      return {
        board: updatedBoard,
        affectedSessions,
      };
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      if (error instanceof EntityNotFoundError) throw error;
      throw new RepositoryError(
        `Failed to delete zone: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
}
