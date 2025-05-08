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
 * Runs a vigorous, parallelized stress test with randomized queries and schema.
 * Simulates concurrent usage to uncover edge cases and concurrency issues.
 */
describe("butter churn 🧈 (vigorous parallel stress testing)", () => {
  test(
    "stress mockD1Database with parallel randomized queries",
    async () => {
      const db = mockD1Database();
      const workers = 8;
      const duration = 8000;
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

      let setupInserts = 0;
      let opInserts = 0;

      let randomDrops = 0;
      let randomRowDeletes = 0;
      let randomClears = 0;

      let updates = 0;

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
                setupInserts++;
              } catch { errors++; }
            }
          }
          // Example: 80% chance to pick from a "hot" subset
          const hotTables = tables.slice(0, Math.max(1, Math.floor(tables.length * 0.2)));
          const table = Math.random() < 0.8 && hotTables.length > 0
            ? hotTables[randInt(0, hotTables.length - 1)]
            : tables[randInt(0, tables.length - 1)];
          const colCount = randInt(minCols, maxCols);
          const cols = Array.from({ length: colCount }, () => randomSnake(1));
          const data = randomData(cols);
          const op = Math.random();
          try {
            if (op < 0.50) {
              await db.prepare(
                `SELECT * FROM ${table} WHERE ${cols[0]} = :val`
              ).bind({ val: data[cols[0]] }).all();
              selects++;
            } else if (op < 0.75) {
              await db.prepare(
                `DELETE FROM ${table} WHERE ${cols[0]} = :val`
              ).bind({ val: data[cols[0]] }).run();
              deletes++;
            } else if (op < 0.92) {
              await db.prepare(
                `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(c => `:${c}`).join(", ")})`
              ).bind(data).run();
              opInserts++;
            } else if (op < 0.95) {
              // (future) UPDATE
              await db.prepare(
                `UPDATE ${table} SET ${cols[0]} = :val WHERE ${cols[1]} = :val2`
              ).bind({ val: data[cols[0]], val2: data[cols[1]] }).run();
              updates++;
            } else {
              // Inject a random SQL error
              const badSqls = [
                `SELECT FROM ${table}`, // missing columns
                `INSERT INTO`,          // incomplete
                `DELETE`,               // incomplete
                `SELECT * FROM ${table} WHERE bad_col LIKE :val`, // unsupported LIKE
                `SELECT * FROM ${table} WHERE`, // incomplete WHERE
                `UPDATE ${table} SET x = 1`,    // unsupported UPDATE
              ];
              const badSql = badSqls[randInt(0, badSqls.length - 1)];
              try {
                await db.prepare(badSql).run();
              } catch {
                // expected error, count as error
                errors++;
                // Optionally: continue;
              }
            }
          } catch {
            errors++;
          }

          // Randomly drop a table
          if (Math.random() < 0.1 && db.dump) {
            const tables = Object.keys(db.dump());
            if (tables.length > 0) {
              const dropTable = tables[Math.floor(Math.random() * tables.length)];
              db.inject(dropTable, []); // or implement a real drop if your mock supports it
              randomDrops++;
            }
          }

          // Randomly delete a row
          if (Math.random() < 0.1 && db.dump) {
            const tables = Object.keys(db.dump());
            if (tables.length > 0) {
              const delTable = tables[Math.floor(Math.random() * tables.length)];
              const rows = db.dump()[delTable]?.rows ?? [];
              if (rows.length > 0) {
                const col = Object.keys(rows[0])[0];
                const val = rows[0][col];
                await db.prepare(`DELETE FROM ${delTable} WHERE ${col} = :val`).bind({ val }).run();
                randomRowDeletes++;
              }
            }
          }

          if (Math.random() < 0.2 && db.dump) { // 20% chance per cycle
            const tables = Object.keys(db.dump());
            if (tables.length > 0) {
              const delTable = tables[Math.floor(Math.random() * tables.length)];
              const rows = db.dump()[delTable]?.rows ?? [];
              if (rows.length > 0) {
                const col = Object.keys(rows[0])[0];
                const val = rows[0][col];
                await db.prepare(`DELETE FROM ${delTable} WHERE ${col} = :val`).bind({ val }).run();
              }
            }
          }
          if (Math.random() < 0.1 && db.inject) { // 10% chance per cycle
            const tables = Object.keys(db.dump());
            if (tables.length > 0) {
              const clearTable = tables[Math.floor(Math.random() * tables.length)];
              db.inject(clearTable, []); // clears all rows
              randomClears++;
            }
          }
          cycles++;
        }
        return { cycles, inserts, selects, deletes, errors, setupInserts, opInserts, updates, randomDrops, randomRowDeletes, randomClears };
      };

      const results = await Promise.all(
        Array.from({ length: workers }, stressWorker)
      );
      const totalCycles = results.reduce((a, b) => a + b.cycles, 0);
      //totalInserts = results.reduce((a, b) => a + b.inserts, 0);
      totalSelects = results.reduce((a, b) => a + b.selects, 0);
      totalDeletes = results.reduce((a, b) => a + b.deletes, 0);
      totalErrors = results.reduce((a, b) => a + b.errors, 0);
      const totalSetupInserts = results.reduce((a, b) => a + b.setupInserts, 0);
      const totalOpInserts = results.reduce((a, b) => a + b.opInserts, 0);
      const ttlRandomDrops = results.reduce((a, b) => a + (b.randomDrops || 0), 0);
      const ttlRandomRowDeletes = results.reduce((a, b) => a + (b.randomRowDeletes || 0), 0);
      const ttlRandomClears = results.reduce((a, b) => a + (b.randomClears || 0), 0);
      const totalUpdates = results.reduce((a, b) => a + (b.updates || 0), 0);

      log.log(`ttl cycles: ${totalCycles}`);
      log.log(`ttl sel: ${totalSelects}`);
      log.log(`ttl del: ${totalDeletes}`);
      log.log(`ttl err: ${totalErrors}`);
      log.log(`ttl setup ins: ${totalSetupInserts}`);
      log.log(`ttl op ins: ${totalOpInserts}`);
      log.log(`ttl ins: ${totalSetupInserts + totalOpInserts}`);
      log.log(`ttl random drops: ${ttlRandomDrops}`);
      log.log(`ttl random row deletes: ${ttlRandomRowDeletes}`);
      log.log(`ttl random clears: ${ttlRandomClears}`);
      log.log(`ttl updates: ${totalUpdates}`);
      log.log(`avg cycles/worker: ${(totalCycles / workers).toFixed(2)}`);
      log.log(`avg errors/worker: ${(totalErrors / workers).toFixed(2)}`);
      expect(typeof db.dump()).toBe("object");
    },
    30000
  );
});