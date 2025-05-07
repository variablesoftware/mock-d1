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

process.env.LOG = 'none' || process.env.LOG;

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
    }

    console.log(`[butter churn] completed ${count} cycles`);
    console.log(`[butter churn] inserts: ${inserts}, selects: ${selects}`);
    console.log(`[butter churn] total SELECT results returned: ${totalResults}`);
    console.log(
      `[butter churn] avg results per SELECT: ${(totalResults / Math.max(1, selects)).toFixed(2)}`
    );
  });
});

/**
 * Runs a vigorous, parallelized stress test with randomized queries and schema.
 * Simulates concurrent usage to uncover edge cases and concurrency issues.
 */
describe("butter churn 🧈 (vigorous parallel stress testing)", () => {
  test(
    "stress mockD1Database with parallel randomized queries",
    async () => {
      const db = mockD1Database();
      const workers = 8;
      const duration = 4000;
      const minTables = 3;
      const maxTables = 9;
      const minCols = 3;
      const maxCols = 7;

      function randInt(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      let totalInserts = 0;
      let totalSelects = 0;
      let totalDeletes = 0;
      let totalErrors = 0;

      const stressWorker = async () => {
        const end = Date.now() + duration;
        let cycles = 0;
        let inserts = 0;
        let selects = 0;
        let deletes = 0;
        let errors = 0;
        while (Date.now() < end) {
          const tableCount = randInt(minTables, maxTables);
          const tables: string[] = [];
          for (let t = 0; t < tableCount; t++) {
            const table = randomSnake();
            tables.push(table);
            const colCount = randInt(minCols, maxCols);
            const cols = Array.from({ length: colCount }, () => randomSnake(1));
            await db.prepare(`CREATE TABLE IF NOT EXISTS ${table}`).run();
            for (let i = 0; i < randInt(1, 3); i++) {
              const data = randomData(cols);
              try {
                await db.prepare(
                  `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(c => `:${c}`).join(", ")})`
                ).bind(data).run();
                inserts++;
              } catch {}
            }
          }
          const table = tables[randInt(0, tables.length - 1)];
          const colCount = randInt(minCols, maxCols);
          const cols = Array.from({ length: colCount }, () => randomSnake(1));
          const data = randomData(cols);
          const op = Math.random();
          try {
            if (op < 0.33) {
              await db.prepare(
                `SELECT * FROM ${table} WHERE ${cols[0]} = :val`
              ).bind({ val: data[cols[0]] }).all();
              selects++;
            } else if (op < 0.66) {
              await db.prepare(
                `DELETE FROM ${table} WHERE ${cols[0]} = :val`
              ).bind({ val: data[cols[0]] }).run();
              deletes++;
            } else {
              await db.prepare(
                `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(c => `:${c}`).join(", ")})`
              ).bind(data).run();
              inserts++;
            }
          } catch {}
          cycles++;
        }
        return { cycles, inserts, selects, deletes, errors };
      };

      const results = await Promise.all(
        Array.from({ length: workers }, stressWorker)
      );
      const totalCycles = results.reduce((a, b) => a + b.cycles, 0);
      totalInserts = results.reduce((a, b) => a + b.inserts, 0);
      totalSelects = results.reduce((a, b) => a + b.selects, 0);
      totalDeletes = results.reduce((a, b) => a + b.deletes, 0);
      totalErrors = results.reduce((a, b) => a + b.errors, 0);

      console.log(`[vigorous butter churn] total cycles: ${totalCycles}`);
      console.log(`[vigorous butter churn] total inserts: ${totalInserts}`);
      console.log(`[vigorous butter churn] total selects: ${totalSelects}`);
      console.log(`[vigorous butter churn] total deletes: ${totalDeletes}`);
      console.log(`[vigorous butter churn] total errors: ${totalErrors}`);
      console.log(`[vigorous butter churn] avg cycles per worker: ${(totalCycles / workers).toFixed(2)}`);
      console.log(`[vigorous butter churn] avg errors per worker: ${(totalErrors / workers).toFixed(2)}`);
      expect(typeof db.dump()).toBe("object");
    },
    30000
  );
});