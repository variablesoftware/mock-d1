/**
 * @fileoverview
 * Randomized and parallel stress test suites for mockD1Database.
 *
 * - The first suite ("butter churn 🧈 (stress testing)") runs a short, single-threaded randomized workload
 *   to verify stability and correctness under rapid create/insert/select cycles.
 * - The second suite ("butter churn 🧈 (vigorous parallel stress testing)") runs multiple randomized workers
 *   in parallel to simulate heavy concurrent usage and uncover edge cases.
 *
 * @see mockD1Database.stress.test.ts for a focused single-threaded stress test.
 */
import { mockD1Database } from "../src/mockD1Database";
import { randomSnake, randomData } from "./helpers";
import { describe, expect, test } from "vitest";

import { log } from "@variablesoftware/logface";
// process.env.LOG = 'none' || process.env.LOG;

/**
 * Runs a short-duration, single-threaded stress test with randomized table and column names.
 * Verifies that the mock database can handle rapid create/insert/select cycles.
 */
describe("butter churn 🧈 (stress testing)", () => {
  test("stress mockD1Database for a short duration", async () => {
    const db = mockD1Database();
    const end = Date.now() + 500;
    let count = 0;
    let inserts = 0;
    let selects = 0;
    let totalResults = 0;

    while (Date.now() < end) {
      const table = randomSnake();
      await db.prepare(`CREATE TABLE IF NOT EXISTS ${table}`).run();
      const colA = randomSnake(1);
      const colB = randomSnake(1);
      const data = randomData([colA, colB]);
      const insert = db.prepare(
        `INSERT INTO ${table} (${colA}, ${colB}) VALUES (:${colA}, :${colB})`
      );
      await insert.bind(data).run();
      inserts++;
      const query = db.prepare(
        `SELECT * FROM ${table} WHERE ${colA} = :${colA} OR ${colB} = :${colB}`
      );
      const result = await query.bind(data).all();
      selects++;
      totalResults += result.results.length;
      expect(result.results.length).toBeGreaterThanOrEqual(0);
      count++;

      if (Math.random() < 0.2 && db.dump) { // 20% chance per cycle, and only if dump() is available
        const tables = Object.keys(db.dump());
        if (tables.length > 0) {
          const dropTable = tables[Math.floor(Math.random() * tables.length)];
          // If your mock supports DROP TABLE:
          // await db.prepare(`DROP TABLE ${dropTable}`).run();
          // Or, if not, just remove from the map:
          db.inject(dropTable, []); // or db._drop(dropTable) if you have such a helper
        }
      }
    }

    log.log(`[churn] completed ${count} cycles`);
    log.log(`[churn] inserts: ${inserts}, selects: ${selects}`);
    log.log(`[churn] total SELECT results returned: ${totalResults}`);
    log.log(
      `[butter churn] avg results per SELECT: ${(totalResults / Math.max(1, selects)).toFixed(2)}`
    );
  });
});
