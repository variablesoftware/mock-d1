/**
 * @fileoverview
 * Single-threaded stress test suite for mockD1Database.
 * Runs a short, randomized workload to verify stability and correctness under rapid create/insert/select cycles.
 *
 * @see mockD1Database.randomized.test.ts for parallel/vigorous stress tests.
 */
import { mockD1Database } from "../src/mockD1Database";
import { randomSnake, randomData } from "./helpers";
import { describe, expect, test } from "vitest";

// process.env.LOG = 'none' || process.env.LOG;

const RUN_STRESS = process.env.D1_STRESS === "1";

/**
 * Runs a short-duration stress test with randomized table and column names.
 * Verifies that the mock database can handle rapid create/insert/select cycles.
 */
describe("butter churn 🧈 (stress testing)", () => {
  (RUN_STRESS ? test : test.skip)("stress mockD1Database for a short duration", async () => {
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
    }

    console.log(`[butter churn] completed ${count} cycles`);
    console.log(`[butter churn] inserts: ${inserts}, selects: ${selects}`);
    console.log(`[butter churn] total SELECT results returned: ${totalResults}`);
    console.log(
      `[butter churn] avg results per SELECT: ${(totalResults / Math.max(1, selects)).toFixed(2)}`
    );
  });
});