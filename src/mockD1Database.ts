/*
 * mockD1Database.ts v2 🧈 (updated for named bind support)
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

// Remove: // @ts-nocheck

import { D1Result } from "@cloudflare/workers-types";
import { log } from "@variablesoftware/logface";
import { D1Row, MockD1PreparedStatement } from "./types/MockD1Database";
import { createPreparedStatement } from "./engine/mockD1PreparedStatement";

export function mockD1Database(): unknown {
  const logger = log.withTag("mockD1");
  const db = new Map<string, { rows: D1Row[] }>();

  function prepare(sql: string): MockD1PreparedStatement {
    return createPreparedStatement(sql, db, logger);
  }

  return {
    prepare,
    batch: async <T = unknown>(statements: MockD1PreparedStatement[]): Promise<D1Result<T>[]> => {
      return Promise.all(statements.map(stmt => stmt.run()));
    },
    dump(): Record<string, { rows: D1Row[] }> {
      // Return a shallow copy of the db map as an object
      return Object.fromEntries(db.entries());
    },
    inject: (table: string, rows: D1Row[]) => {
      db.set(table, { rows: [...rows] });
    },
    withSession: () => ({
      prepare,
      batch: async <T = unknown>(statements: MockD1PreparedStatement[]): Promise<D1Result<T>[]> => {
        return Promise.all(statements.map(stmt => stmt.run()));
      },
      getBookmark: () => null,
    }),
  };
}
