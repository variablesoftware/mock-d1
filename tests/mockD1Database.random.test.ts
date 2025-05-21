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
import { describe, expect, test } from "vitest";
import { log } from "@variablesoftware/logface";
import fc from "fast-check";

// Refine fast-check arbitraries to ensure valid SQL-compatible values
const snakeCaseArb = fc.string({ minLength: 1, maxLength: 16 }).filter(value => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)); // Valid SQL identifiers
const dataArb = fc.record({
  colA: fc.oneof(
    fc.string({ minLength: 1, maxLength: 255 }).filter(value => /^[a-zA-Z][a-zA-Z0-9 ]*$/.test(value) && value !== "NaN"),
    fc.integer().filter(value => !isNaN(value)) // Exclude numeric NaN values
  ),
  colB: fc.oneof(
    fc.string({ minLength: 1, maxLength: 255 }).filter(value => /^[a-zA-Z][a-zA-Z0-9 ]*$/.test(value) && value !== "NaN"),
    fc.integer().filter(value => !isNaN(value)) // Exclude numeric NaN values
  )
});

const RUN_STRESS = process.env.D1_STRESS === "1";

/**
 * Runs a short-duration, single-threaded stress test with randomized table and column names.
 * Verifies that the mock database can handle rapid create/insert/select cycles.
 */
describe("butter churn 🧈 (stress testing)", () => {
  (RUN_STRESS ? test : test.skip)(
    "stress mockD1Database for a short duration",
    async () => {
      await fc.assert(
        fc.asyncProperty(snakeCaseArb, snakeCaseArb, dataArb, async (table, colA, data) => {
          const db = mockD1Database();
          const end = Date.now() + 500;
          let count = 0;
          let inserts = 0;
          let selects = 0;
          let totalResults = 0;

          while (Date.now() < end) {
            await db.prepare(`CREATE TABLE IF NOT EXISTS ${table}`).run();
            const insert = db.prepare(
              `INSERT INTO ${table} (${colA}, colB) VALUES (:colA, :colB)`
            );
            await insert.bind(data).run();
            inserts++;

            const select = db.prepare(`SELECT * FROM ${table}`);
            const results = await select.all();
            selects++;
            totalResults += results.results.length; // Adjusted to access the correct property

            count++;
          }

          expect(count).toBeGreaterThan(0);
          expect(inserts).toBeGreaterThan(0);
          expect(selects).toBeGreaterThan(0);
          expect(totalResults).toBeGreaterThan(0);
        })
      );
    },
    60000 // Set timeout to 60 seconds
  );
});
