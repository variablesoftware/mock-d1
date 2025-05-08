/*
 * mockD1Database.ts v3 🧈 (updated for named bind support)
 *
 * A lightweight, test-optimized mock of Cloudflare's D1Database interface.
 * Designed for Workers unit testing without requiring a live D1 instance.
 *
 * ✅ Supported SQL commands (simplified parsing):
 *   - CREATE TABLE [IF NOT EXISTS]
 *   - DROP TABLE (stubbed via `delete db[table]` expected externally)
 *   - INSERT INTO ... VALUES (...)
 *   - SELECT * FROM ... WHERE ... (supports AND/OR + named binds)
 *   - DELETE FROM ... WHERE ... (with accurate changes count)
 *
 * 🧩 Internal mechanics:
 *   - Tables stored in `Map<string, { rows: D1Row[] }>`
 *   - Uses basic regex parsing — not SQL-standards compliant
 *   - No type coercion — binds and data are raw JS primitives
 *   - Validation of :bind args occurs during execution, not .bind()
 *   - Logs behavior when LOG includes "D1" at level 3 or above
 *
 * 🧪 Test-only helpers:
 *   - `inject(table, rows[])`: manually preload test data
 *   - `dump()`: returns full mock DB snapshot
 *   - `batch()`: stubbed to return empty D1Result[]
 *
 * 🧱 Design notes:
 *   - Safe for isolated tests (no persistence between runs)
 *   - Reflects Cloudflare D1 runtime quirks (bind usage, defer errors)
 *   - Implements prepare().bind().run()/all()/first()/raw() interface
 *
 * 🧠 Future support ideas:
 *   - UPDATE ... SET ... WHERE ...
 *   - LIKE, BETWEEN, NOT, nested conditions
 *   - JOIN or mock link handling
 *   - ORDER BY, LIMIT
 */

import { log } from "@variablesoftware/logface";
import { createPreparedStatement } from "./engine/mockD1PreparedStatement";
import { D1Row, MockD1PreparedStatement, FakeD1Result } from "./types/MockD1Database";
import type { Logger } from "@variablesoftware/logface"; // adjust path as needed

const logger: Logger = log.withTag(`mockD1:${Math.random().toString(36).slice(2, 7)}`);

/**
 * Creates a new mock D1 database instance.
 *
 * @returns An object implementing the mock D1Database interface, including:
 *  - prepare(sql): prepares a statement for execution
 *  - batch(statements): executes multiple statements in parallel
 *  - dump(): returns a snapshot of the current database state
 *  - inject(table, rows): preloads data into a table
 *  - withSession(): returns a session-scoped interface
 */
export function mockD1Database(): unknown {
  const db = new Map<string, { rows: D1Row[] }>();
  //logger.debug("initialized");

  /**
   * Logs basic database stats for debugging.
   */
  //function dbStats() {
  //  logger.debug("db size", db.size);
  //}

  /**
   * Prepares a SQL statement for execution.
   * @param sql - The SQL statement string.
   * @returns A mock prepared statement.
   */
  function prepare(sql: string): MockD1PreparedStatement {
    return createPreparedStatement(sql, db, logger);
  }

  return {
    /**
     * Prepares a SQL statement for execution.
     */
    prepare,

    /**
     * Executes multiple prepared statements in parallel.
     * @param statements - Array of prepared statements.
     * @returns Promise resolving to an array of results.
     */
    batch: async <T = unknown>(statements: MockD1PreparedStatement[]): Promise<FakeD1Result<T>[]> => {
      return Promise.all(statements.map(stmt => stmt.run() as Promise<FakeD1Result<T>>));
    },

    /**
     * Returns a snapshot of the current database state.
     * @returns An object mapping table names to their rows.
     */
    dump(): Record<string, { rows: D1Row[] }> {
      //dbStats();
      return Object.fromEntries(db.entries());
    },

    /**
     * Preloads data into a table for testing.
     * @param table - The table name.
     * @param rows - The rows to inject.
     */
    inject: (table: string, rows: D1Row[]) => {
      db.set(table, { rows: [...rows] });
    },

    /**
     * Returns a session-scoped interface for transactional-style usage.
     * @returns An object with prepare, batch, and getBookmark methods.
     */
    withSession: () => ({
      prepare,
      batch: async <T = unknown>(statements: MockD1PreparedStatement[]): Promise<FakeD1Result<T>[]> => {
        return Promise.all(statements.map(stmt => stmt.run() as Promise<FakeD1Result<T>>));
      },
      getBookmark: () => null,
    }),
  };
}
