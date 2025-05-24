import { mockD1Database } from "../../src";
import { describe, expect, test } from "vitest";
import fc from "fast-check";

// Only generate valid SQL identifiers and data
const snakeCaseArb = fc.string({ minLength: 1, maxLength: 16 })
  .filter(value => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value));
const valueArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 255 }).filter(value => /^[a-zA-Z][a-zA-Z0-9 ]*$/.test(value) && value !== "NaN"),
  fc.integer().filter(value => !isNaN(value))
);

const RUN_STRESS = process.env.D1_STRESS === "1";

(RUN_STRESS ? describe : describe.skip)("butter churn 🧈 (valid stress testing)", () => {
  test(
    "stress mockD1Database with valid randomized queries",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(snakeCaseArb, snakeCaseArb).filter(([a, b]) => a.toLowerCase() !== b.toLowerCase()),
          fc.tuple(valueArb, valueArb),
          async (columns, values) => {
            const [colA, colB] = columns;
            const [valA, valB] = values;
            const table = colA + "_tbl";
            const db = mockD1Database();
            const end = Date.now() + 500;
            let count = 0, inserts = 0, selects = 0, totalResults = 0;

            // Bind argument keys match generated column names exactly and in order
            const bindArgs: Record<string, unknown> = Object.fromEntries(columns.map((col, i) => [col, values[i]]));

            while (Date.now() < end) {
              await db.prepare(`CREATE TABLE IF NOT EXISTS ${table} (${colA} TEXT, ${colB} TEXT)`).run();
              await db.prepare(`INSERT INTO ${table} (${colA}, ${colB}) VALUES (:${colA}, :${colB})`).bind(bindArgs).run();
              inserts++;
              const results = await db.prepare(`SELECT * FROM ${table}`).all();
              selects++;
              totalResults += results.results.length;
              count++;
            }
            expect(count).toBeGreaterThan(0);
            expect(inserts).toBeGreaterThan(0);
            expect(selects).toBeGreaterThan(0);
            expect(totalResults).toBeGreaterThan(0);
          }
        ),
        { numRuns: 10 } // Lower the number of runs for faster stress tests
      );
    },
    60000
  );
});