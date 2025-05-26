/**
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
import { createPreparedStatement } from "./engine/preparedStatement.js";
import { D1Row, MockD1PreparedStatement, D1Database } from "./types/MockD1Database.js";
import { mockInject } from "./helpers/mockInject.js";
import { mockBatch } from "./helpers/mockBatch.js";

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
export function mockD1Database(): D1Database {
  const db = new Map<string, { rows: D1Row[]; columns: import('./types/MockD1Database.js').MockD1TableColumn[] }>();

  log.debug("mockD1Database created", { db });
  /**
   * Prepares a SQL statement for execution.
   * @param sql - The SQL statement string.
   * @returns A mock prepared statement.
   */
  function prepare(sql: string): MockD1PreparedStatement {
    return createPreparedStatement(sql, db);
  }

  /**
   * Preloads data into a table for testing (mock/test helper only).
   * @warning This is a mock/test-only API. Emits a warning if used outside test.
   * @param table - The table name.
   * @param columns - The explicit table schema columns (required).
   * @param rows - The rows to inject.
   */
  function inject(tableName: string, columns: import('./types/MockD1Database.js').MockD1TableColumn[], rows: Record<string, unknown>[]) {
    mockInject(db, tableName, columns, rows);
  }

  /**
   * Returns a snapshot of the current database state (mock/test helper only).
   * @warning This is a mock/test-only API. Emits a warning if used outside test.
   * @returns An object mapping table names to their rows.
   */
  function dump(): Record<string, { rows: D1Row[] }> {
    return Object.fromEntries(db.entries());
  }

  return {
    prepare,
    batch: mockBatch,
    dump,
    inject,
  };
}
