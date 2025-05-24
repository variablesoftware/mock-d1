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

const RUN_DURATION = process.env.D1_STRESS_DURATION
  ? parseInt(process.env.D1_STRESS_DURATION, 10) * 1000
  : 2000;
// Probability modifiers for setup worker operations
const PROB_SETUP_CREATE_TABLE = 1.0; // 100% chance to create each table in setup
const PROB_SETUP_INSERT_ROW = 1.0;   // 100% chance to insert each initial row in setup

// Probability modifiers for random destructive operations
const PROB_DROP_TABLE = 0.042;   // 1.2% chance per cycle to drop a table
const PROB_ROW_DELETE = 0.0452;  // 5.2% chance per cycle to delete a row
const PROB_CLEAR_TABLE = 0.0451; // 5.1% chance per cycle to clear a table

// Probability modifiers for main worker operations
const PROB_OP_SELECT = 0.45;      // 45% chance to SELECT
const PROB_OP_DELETE = 0.25;      // 25% chance to DELETE (0.45 to 0.70)
const PROB_OP_INSERT = 0.20;      // 20% chance to INSERT (0.70 to 0.90)
const PROB_OP_UPDATE = 0.09;      // 3% chance to UPDATE (0.90 to 0.93)
const PROB_OP_CREATE_TABLE = 0.03;// 3% chance to CREATE TABLE (0.93 to 0.96)
const PROB_OP_ALTER_TABLE = 0.02; // 2% chance to ALTER TABLE (0.96 to 0.98)
const PROB_OP_ALTER_TABLE_DROP = 0.01; // 1% chance to DROP COLUMN (tunable)
const PROB_OP_ALTER_TABLE_RENAME = 0.005; // 0.5% chance to RENAME COLUMN (tunable)

const SAMPLE_RATE = 0.1;

import { mockD1Database } from "../../src";
import { randomSnake, randomData } from "../helpers";
import { describe, expect, test } from "vitest";

import { log } from "@variablesoftware/logface";

// At the top, after imports, set logface to error unless D1_STRESS_VERBOSE is set
// D1_STRESS_VERBOSE=2 enables debug, =1 enables warn/info, unset or 0 is error only
const verboseLevel = parseInt(process.env.D1_STRESS_VERBOSE || '0', 10);
if (verboseLevel >= 2) {
  log.setLogLevel('debug');
} else if (verboseLevel === 1) {
  log.setLogLevel('warn');
} else {
  log.setLogLevel('error');
}

const RUN_STRESS = process.env.D1_STRESS === "1";

// Global counters for unique operation IDs across all workers (single process)
let globalErrorId = 0;
let globalSelectId = 0;
let globalDeleteId = 0;
let globalInsertId = 0;
let globalUpdateId = 0;
let globalRandomDropId = 0;
let globalRandomRowDeleteId = 0;
let globalRandomClearId = 0;

// Utility: summarize large string values for logging
function summarizeValue(val: unknown): unknown {
  if (typeof val === 'string' && val.length > 8) {
    return `[str:${val.length}]${val.slice(0, 2)}..${val.slice(-2)}`;
  }
  return val;
}
function summarizeRow(row: Record<string, unknown> | undefined | null): Record<string, unknown> | undefined | null {
  if (!row || typeof row !== 'object') return row;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, summarizeValue(v)]));
}

// Centralized error log function for stress worker
function logStressError({
  workerId,
  opId,
  errorId,
  op,
  table,
  sql,
  err,
  cols,
  data,
  isValid,
  db,
  tableColsMap
}: {
  workerId: number;
  opId: number;
  errorId: number;
  op: string;
  table: string;
  sql: string;
  err: string;
  cols?: string[];
  data?: Record<string, unknown>;
  isValid?: boolean;
  db?: ReturnType<typeof mockD1Database>;
  tableColsMap?: Map<string, string[]>;
}) {
  log.error(
    `isValid=${isValid} | opId:${opId} | worker=${workerId} | #${errorId} op=${op} table=${table}` +
    (sql ? ` | 🐛 SQL: ${sql}` : '') +
    (cols ? ` | 🧩 Cols: ${JSON.stringify(cols)}` : '') +
    (data ? ` | 🗄️ Keys: ${JSON.stringify(Object.keys(data ?? {}))}` : '') +
    (data ? ` | 🗄️ Data: ${JSON.stringify(summarizeRow(data))}` : '') +
    (err ? ` | err: ${err}` : '')
  );
  // Extra diagnostics for column errors
  if (
    verboseLevel >= 2 &&
    err &&
    typeof err === 'string' &&
    err.toLowerCase().includes('column does not exist') &&
    db &&
    tableColsMap &&
    table
  ) {
    const dump = db.dump?.();
    const dumpCols = dump && dump[table] && dump[table].rows && dump[table].rows[0]
      ? Object.keys(dump[table].rows[0])
      : [];
    const mapCols = tableColsMap.get(table) || [];
    const sampleRow = dump && dump[table] && dump[table].rows && dump[table].rows[0]
      ? summarizeRow(dump[table].rows[0])
      : undefined;
    log.debug(
      `[DIAG] opId:${opId} worker:${workerId} table:${table} | tableColsMap: ${JSON.stringify(mapCols)} | db.dump cols: ${JSON.stringify(dumpCols)} | sampleRow: ${JSON.stringify(sampleRow)}`
    );
  }
}

/**
 * Runs a vigorous, parallelized stress test with randomized queries and schema.
 * Simulates concurrent usage to uncover edge cases and concurrency issues.
 */
(RUN_STRESS ? describe : describe.skip)("butter churn 🧈 (vigorous parallel stress testing)", () => {
  test(
    "stress mockD1Database with parallel randomized queries",
    async () => {
      const db = mockD1Database();
      const workers = 8;
      const duration = RUN_DURATION;
      const minTables = 18; // Increased minimum
      const maxTables = 60; // Increased maximum
      const minCols = 4;
      const maxCols = 10; // Increased maximum

      function randInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      // Utility: ensure all columns are present in data and not undefined/null
      function isValidInsert(cols: string[], data: Record<string, unknown> | undefined | null): boolean {
        if (!Array.isArray(cols) || cols.length === 0) return false;
        if (!data || typeof data !== 'object') return false;
        // All keys in cols must exist in data and be non-null/undefined, and no extra keys
        const dataKeys = Object.keys(data);
        if (dataKeys.length !== cols.length) return false;
        return cols.every(c => typeof c === 'string' && c && Object.prototype.hasOwnProperty.call(data, c) && data[c] !== undefined && data[c] !== null);
      }

      // Utility: generate a column name in the form XXXX_XXXX_XXXX
      function randomShortColName(): string {
        const randChunk = () => Math.random().toString(36).slice(2, 6).padEnd(4, 'x');
        return `${randChunk()}_${randChunk()}_${randChunk()}`;
      }

      // Utility: generate a large random string of a given size (in bytes)
      function randomLargeString(size: number): string {
        // Use base64 for compactness
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let result = '';
        for (let i = 0; i < size; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      }

      // Store table -> columns mapping for consistent operations
      const tableColsMap = new Map<string, string[]>();
      const tables: string[] = [];

      let setupInserts = 0; // Track setup inserts globally in the test scope
      let setupCreates = 0; // Track CREATE TABLE statements globally

      // Setup: create tables and columns, and store in map
      const tableCount = randInt(minTables, maxTables);
      for (let t = 0; t < tableCount; t++) {
        const table = randomSnake();
        tables.push(table);
        const colCount = randInt(minCols, maxCols);
        // Use short, fixed-format column names
        const cols = Array.from({ length: colCount }, () => randomShortColName());
        tableColsMap.set(table, cols);
        await db.prepare(
          `CREATE TABLE IF NOT EXISTS ${table} (${cols.map(c => `${c} TEXT`).join(", ")})`
        ).run();
        setupCreates++; // Increment for each CREATE TABLE
        // Insert initial rows
        for (let i = 0; i < randInt(1, 3); i++) {
          let data = randomData(cols);
          // 10% of setup inserts: fill one column with a large string (128KB)
          if (Math.random() < 0.1 && cols.length > 0) {
            const bigCol = cols[randInt(0, cols.length - 1)];
            data = { ...data, [bigCol]: randomLargeString(128 * 1024) };
          }
          try {
            if (isValidInsert(cols, data)) {
              await db.prepare(
                `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(c => `:${c}`).join(", ")})`
              ).bind({ ...data }).run();
              setupInserts++;
            } else {
              // Only warn if not in quiet mode
              if (process.env.D1_STRESS_VERBOSE === '1') {
                log.warn(`Skipping setup insert for table ${table}: invalid data for columns [${cols.join(", ")}]. Data: ${JSON.stringify(data)}`);
              }
            }
          } catch {
            // Ignore setup errors
          }
        }
      }

      const stressWorker = async (workerId: number) => {
        const end = Date.now() + duration;
        let cycles = 0;
        let selects = 0;
        let deletes = 0;
        let errors = 0;
        let opInserts = 0;
        let updates = 0;
        let randomDrops = 0;
        let randomRowDeletes = 0;
        let randomClears = 0;
        let dbSnapshot = db.dump();
        let opId = 0;

        while (Date.now() < end) {
          // Pick a table and its columns
          const table = tables[randInt(0, tables.length - 1)];
          const cols = tableColsMap.get(table) ?? [];
          const data = randomData(cols);
          const op = Math.random();
          let mutated = false;
          let sql = '';
          opId++;

          // Occasionally exercise the schema row directly
          if (Math.random() < 0.01) { // 1% of cycles
            const tableData = db.dump()[table];
            if (tableData && tableData.rows && tableData.rows.length > 0) {
              const schemaRow = tableData.rows[0];
              const schemaCol = Object.keys(schemaRow)[0];
              // Only log schema row state at a sample rate
              if (Math.random() < SAMPLE_RATE) {
                log.debug(`[schema-row] worker=${workerId} opId=${opId} table=${table} schemaRow=${JSON.stringify(schemaRow)}`);
              }
              // Try to update a schema row column
              if (schemaCol) {
                try {
                  await db.prepare(`UPDATE ${table} SET ${schemaCol} = :val WHERE ${schemaCol} IS NULL`).bind({ val: '__schema_test__', __opId: opId, __workerId: workerId }).run();
                  if (Math.random() < SAMPLE_RATE) log.debug(`[schema-row-update] worker=${workerId} opId=${opId} table=${table} col=${schemaCol}`);
                } catch (err) {
                  if (Math.random() < SAMPLE_RATE) log.debug(`[schema-row-update-error] worker=${workerId} opId=${opId} table=${table} col=${schemaCol} err=${(err as Error).message}`);
                }
              }
              // Try to delete the schema row (should be a no-op or error)
              try {
                await db.prepare(`DELETE FROM ${table} WHERE ${schemaCol} IS NULL`).bind({ __opId: opId, __workerId: workerId }).run();
                if (Math.random() < SAMPLE_RATE) log.debug(`[schema-row-delete-attempt] worker=${workerId} opId=${opId} table=${table}`);
              } catch (err) {
                if (Math.random() < SAMPLE_RATE) log.debug(`[schema-row-delete-error] worker=${workerId} opId=${opId} table=${table} err=${(err as Error).message}`);
              }
            }
          }

          try {
            if (op < PROB_OP_SELECT) {
              sql = `SELECT * FROM ${table} WHERE ${cols[0]} = :val`;
              await db.prepare(sql).bind({ val: data[cols[0]], __opId: opId, __workerId: workerId }).all();
              selects++;
              ++globalSelectId;
            } else if (op < PROB_OP_SELECT + PROB_OP_DELETE) {
              if (cols.length > 0 && cols[0]) {
                sql = `DELETE FROM ${table} WHERE ${cols[0]} = :val`;
                await db.prepare(sql).bind({ val: data[cols[0]], __opId: opId, __workerId: workerId }).run();
                deletes++;
                mutated = true;
                ++globalDeleteId;
              }
            } else if (op < PROB_OP_SELECT + PROB_OP_DELETE + PROB_OP_INSERT) {
              let opData = data;
              if (cols.length > 0 && cols.every(Boolean) && isValidInsert(cols, opData)) {
                // 5% of op inserts: fill one column with a large string (256KB)
                if (Math.random() < 0.05 && cols.length > 0) {
                  const bigCol = cols[randInt(0, cols.length - 1)];
                  opData = { ...opData, [bigCol]: randomLargeString(256 * 1024) };
                }
                sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(c => `:${c}`).join(", ")})`;
                // Defensive: re-validate just before insert
                if (isValidInsert(cols, opData)) {
                  const safeData = { ...opData, __opId: opId, __workerId: workerId };
                  await db.prepare(sql).bind(safeData).run();
                  opInserts++;
                  mutated = true;
                  ++globalInsertId;
                } else {
                  if (process.env.D1_STRESS_VERBOSE === '1') {
                    log.warn(`Skipped op insert (recheck failed) for table ${table}: invalid data for columns [${cols.join(", ")}]. Data: ${JSON.stringify(opData)}`);
                  }
                }
              } else if (cols.length > 0 && cols.every(Boolean)) {
                if (process.env.D1_STRESS_VERBOSE === '1') {
                  log.warn(`Skipping op insert for table ${table}: invalid data for columns [${cols.join(", ")}]. Data: ${JSON.stringify(opData)}`);
                }
              }
            } else if (op < PROB_OP_SELECT + PROB_OP_DELETE + PROB_OP_INSERT + PROB_OP_UPDATE && cols.length > 1 && cols[0] && cols[1]) {
              if (typeof cols[0] === 'string' && typeof cols[1] === 'string') {
                sql = `UPDATE ${table} SET ${cols[0]} = :val WHERE ${cols[1]} = :val2`;
                await db.prepare(sql).bind({ val: data[cols[0]], val2: data[cols[1]], __opId: opId, __workerId: workerId }).run();
                updates++;
                mutated = true;
                ++globalUpdateId;
              }
            } else if (op < PROB_OP_SELECT + PROB_OP_DELETE + PROB_OP_INSERT + PROB_OP_UPDATE + PROB_OP_CREATE_TABLE) {
              // Randomly create a new table (DDL churn)
              const newTable = randomSnake();
              const newColCount = randInt(minCols, maxCols);
              // Use short, fixed-format column names
              const newCols = Array.from({ length: newColCount }, () => randomShortColName());
              sql = `CREATE TABLE IF NOT EXISTS ${newTable} (${newCols.map(c => `${c} TEXT`).join(", ")})`;
              tableColsMap.set(newTable, newCols);
              tables.push(newTable);
              await db.prepare(sql).run();
              setupCreates++;
              for (let i = 0; i < randInt(1, 2); i++) {
                const newData = randomData(newCols);
                try {
                  const insql = `INSERT INTO ${newTable} (${newCols.join(", ")}) VALUES (${newCols.map(c => `:${c}`).join(", ")})`;
                  if (isValidInsert(newCols, newData)) {
                    // Defensive: re-validate just before insert
                    if (isValidInsert(newCols, newData)) {
                      const safeData = { ...newData, __opId: opId, __workerId: workerId };
                      try {
                        await db.prepare(insql).bind(safeData).run();
                        setupInserts++;
                      } catch (err) {
                        log.error(
                          `[bind/insert] Error on table ${newTable}\nCols: ${JSON.stringify(newCols)}\nData: ${JSON.stringify(safeData)}\nDataProto: ${Object.getPrototypeOf(safeData)}\nDataCtor: ${safeData.constructor?.name}\nColsProto: ${Object.getPrototypeOf(newCols)}\nColsCtor: ${newCols.constructor?.name}\nErr: ${(err as Error).message}`
                        );
                        throw err;
                      }
                    } else {
                      // Only warn if not in quiet mode
                      if (process.env.D1_STRESS_VERBOSE === '1') {
                        log.warn(`Skipped churn insert (recheck failed) for table ${newTable}: invalid data for columns [${newCols.join(", ")}]. Data: ${JSON.stringify(newData)}`);
                      }
                    }
                  } else {
                    // Only warn if not in quiet mode
                    if (process.env.D1_STRESS_VERBOSE === '1') {
                      log.warn(`Skipping churn insert for table ${newTable}: invalid data for columns [${newCols.join(", ")}]. Data: ${JSON.stringify(newData)}`);
                    }
                  }
                } catch {
                  // Ignore setup errors
                }
              }
              mutated = true;
            } else if (op < PROB_OP_SELECT + PROB_OP_DELETE + PROB_OP_INSERT + PROB_OP_UPDATE + PROB_OP_CREATE_TABLE + PROB_OP_ALTER_TABLE) {
              // Randomly ALTER TABLE to add a new column
              if (tables.length > 0) {
                const alterTable = tables[randInt(0, tables.length - 1)];
                // Use short, fixed-format column names
                const newCol = randomShortColName();
                sql = `ALTER TABLE ${alterTable} ADD COLUMN ${newCol} TEXT`;
                try {
                  await db.prepare(sql).run();
                  const currentCols = tableColsMap.get(alterTable) ?? [];
                  tableColsMap.set(alterTable, [...currentCols, newCol]);
                  mutated = true;
                } catch (err) {
                  errors++;
                  const errorId = ++globalErrorId;
                  logStressError({
                    workerId,
                    opId,
                    errorId,
                    op: 'ALTER_ADD',
                    table: alterTable,
                    sql,
                    err: (err as Error).message,
                    isValid: undefined,
                    db,
                    tableColsMap
                  });
                }
              }
            } else if (op < PROB_OP_SELECT + PROB_OP_DELETE + PROB_OP_INSERT + PROB_OP_UPDATE + PROB_OP_CREATE_TABLE + PROB_OP_ALTER_TABLE + PROB_OP_ALTER_TABLE_DROP) {
              // Randomly ALTER TABLE to drop a column (if supported)
              if (tables.length > 0) {
                const alterTable = tables[randInt(0, tables.length - 1)];
                const currentCols = tableColsMap.get(alterTable) ?? [];
                // Only drop if more than minCols remain
                if (currentCols.length > minCols) {
                  // Use short, fixed-format column names
                  const dropCol = currentCols[randInt(0, currentCols.length - 1)];
                  sql = `ALTER TABLE ${alterTable} DROP COLUMN ${dropCol}`;
                  try {
                    await db.prepare(sql).run();
                    // Remove from map
                    tableColsMap.set(alterTable, currentCols.filter(c => c !== dropCol));
                    mutated = true;
                  } catch (err) {
                    errors++;
                    const errorId = ++globalErrorId;
                    logStressError({
                      workerId,
                      opId,
                      errorId,
                      op: 'ALTER_DROP',
                      table: alterTable,
                      sql,
                      err: (err as Error).message,
                      isValid: undefined,
                      db,
                      tableColsMap
                    });
                  }
                }
              }
            } else if (op < PROB_OP_SELECT + PROB_OP_DELETE + PROB_OP_INSERT + PROB_OP_UPDATE + PROB_OP_CREATE_TABLE + PROB_OP_ALTER_TABLE + PROB_OP_ALTER_TABLE_DROP + PROB_OP_ALTER_TABLE_RENAME) {
              // Randomly ALTER TABLE to rename a column (if supported)
              if (tables.length > 0) {
                const alterTable = tables[randInt(0, tables.length - 1)];
                const currentCols = tableColsMap.get(alterTable) ?? [];
                if (currentCols.length > 0) {
                  // Use short, fixed-format column names
                  const renameCol = currentCols[randInt(0, currentCols.length - 1)];
                  const newColName = randomShortColName();
                  sql = `ALTER TABLE ${alterTable} RENAME COLUMN ${renameCol} TO ${newColName}`;
                  try {
                    await db.prepare(sql).run();
                    // Update map
                    tableColsMap.set(alterTable, currentCols.map(c => c === renameCol ? newColName : c));
                    mutated = true;
                  } catch (err) {
                    errors++;
                    const errorId = ++globalErrorId;
                    logStressError({
                      workerId,
                      opId,
                      errorId,
                      op: 'ALTER_RENAME',
                      table: alterTable,
                      sql,
                      err: (err as Error).message,
                      isValid: undefined,
                      db,
                      tableColsMap
                    });
                  }
                }
              }
            }
          } catch (err) {
            errors++;
            const errorId = ++globalErrorId;
            logStressError({
              workerId,
              opId,
              errorId,
              op: op.toFixed(2),
              table,
              sql,
              err: (err as Error).message,
              cols,
              data,
              isValid: isValidInsert(cols, data),
              db,
              tableColsMap
            });
          }

          // Randomly drop a table
          if (Math.random() < PROB_DROP_TABLE && dbSnapshot) {
            const snapTables = Object.keys(dbSnapshot);
            if (snapTables.length > 0) {
              const dropTable = snapTables[Math.floor(Math.random() * snapTables.length)];
              db.inject(dropTable, []);
              randomDrops++;
              mutated = true;
              ++globalRandomDropId;
            }
          }

          // Randomly delete a row
          if (Math.random() < PROB_ROW_DELETE && dbSnapshot) {
            const tables = Object.keys(dbSnapshot);
            if (tables.length > 0) {
              const delTable = tables[Math.floor(Math.random() * tables.length)];
              const rows = dbSnapshot[delTable]?.rows ?? [];
              if (rows.length > 0 && rows[0]) { // Ensure rows[0] is defined
                const col = Object.keys(rows[0])[0];
                const val = rows[0][col];
                await db.prepare(`DELETE FROM ${delTable} WHERE ${col} = :val`).bind({ val, __opId: opId, __workerId: workerId }).run();
                randomRowDeletes++;
                mutated = true;
                ++globalRandomRowDeleteId;
              }
            }
          }

          // Randomly clear a table
          if (Math.random() < PROB_CLEAR_TABLE && db.inject && dbSnapshot) {
            const tables = Object.keys(dbSnapshot);
            if (tables.length > 0) {
              const clearTable = tables[Math.floor(Math.random() * tables.length)];
              db.inject(clearTable, []); // clears all rows
              randomClears++;
              mutated = true;
              ++globalRandomClearId;
            }
          }

          // Only refresh snapshot if there was a mutation
          if (mutated) {
            dbSnapshot = db.dump();
          }

          cycles++;
        }
        return { cycles, selects, deletes, errors, setupInserts, opInserts, updates, randomDrops, randomRowDeletes, randomClears };
      };

      const results = await Promise.all(
        Array.from({ length: workers }, (_, i) => stressWorker(i + 1))
      );
      const totalCycles = results.reduce((a, b) => a + b.cycles, 0);
      const totalSelects = results.reduce((a, b) => a + b.selects, 0);
      const totalDeletes = results.reduce((a, b) => a + b.deletes, 0);
      const totalErrors = results.reduce((a, b) => a + b.errors, 0);
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
      log.log(`ttl create table: ${setupCreates}`);
      log.log(`ttl setup ins: ${totalSetupInserts}`);
      log.log(`ttl op ins: ${totalOpInserts}`);
      log.log(`ttl ins: ${setupInserts + totalOpInserts}`);
      log.log(`ttl random drops: ${ttlRandomDrops}`);
      log.log(`ttl random row deletes: ${ttlRandomRowDeletes}`);
      log.log(`ttl random clears: ${ttlRandomClears}`);
      log.log(`ttl updates: ${totalUpdates}`);
      log.log(`avg cycles/worker: ${(totalCycles / workers).toFixed(2)}`);
      log.log(`avg errors/worker: ${(totalErrors / workers).toFixed(2)}`);
      expect(typeof db.dump()).toBe("object");
    },
    60000
  );
});