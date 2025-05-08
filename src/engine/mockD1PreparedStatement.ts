/**
 * @fileoverview
 * Implementation of the MockD1PreparedStatement for mockD1Database.
 */

import { D1Row, MockD1PreparedStatement } from "../types/MockD1Database";
import { log } from "@variablesoftware/logface";

/**
 * Creates a mock prepared statement for the given SQL and database state.
 * @param sql The SQL statement string.
 * @param db The in-memory database map.
 * @param logger The logger instance.
 */
export function createPreparedStatement(
  sql: string,
  db: Map<string, { rows: D1Row[] }>,
  _logger: ReturnType<typeof log> // <-- use a single underscore
): MockD1PreparedStatement {
  // Throw on unsupported SQL at prepare-time
  if (
    /\blike\b/i.test(sql) ||
    /\bbetween\b/i.test(sql) ||
    /\bjoin\b/i.test(sql)
  ) {
    throw new Error("Unsupported SQL syntax in mockD1Database: LIKE, BETWEEN, JOIN not implemented.");
  }

  if (
    !/^create table(?: if not exists)? [a-zA-Z0-9_]+/i.test(sql) &&
    !/^insert into [a-zA-Z0-9_]+/i.test(sql) &&
    !/^select \* from [a-zA-Z0-9_]+/i.test(sql) &&
    !/^delete from [a-zA-Z0-9_]+/i.test(sql) &&
    !/^update [a-zA-Z0-9_]+ set /i.test(sql) // <-- add this line
  ) {
    throw new Error("Malformed or unsupported SQL syntax.");
  }

  let bindArgs: Record<string, unknown> = {};

  function matchesWhere(row: D1Row, cond: string): boolean {
    // OR groups
    return cond.split(/\s+or\s+/i).some(orGroup =>
      orGroup.split(/\s+and\s+/i).every(expr => {
        const m = expr.match(/([a-zA-Z0-9_]+)\s*=\s*:(\w+)/);
        if (!m) return false;
        const [, col, bind] = m;
        if (!(bind in bindArgs)) throw new Error(`Missing bind argument: ${bind}`);
        return row[col] === bindArgs[bind];
      })
    );
  }

  function parseAndRun(mode: "run" | "all" | "first" | "raw") {
    // CREATE TABLE
    if (/^create table/i.test(sql)) {
      const tableMatch = sql.match(/create table(?: if not exists)? ([a-zA-Z0-9_]+)/i);
      if (tableMatch) {
        const table = tableMatch[1];
        if (!db.has(table)) db.set(table, { rows: [] });
        return {
          success: true,
          results: [],
          meta: {
            duration: 0, size_after: 0, rows_read: 0, rows_written: 0,
            last_row_id: 0, changed_db: true, changes: 0,
          },
        };
      }
    }

    // INSERT INTO
    if (/^insert into/i.test(sql)) {
      const tableMatch = sql.match(/insert into ([a-zA-Z0-9_]+)/i);
      const colMatch = sql.match(/\(([^)]+)\)/);
      if (tableMatch && colMatch) {
        const table = tableMatch[1];
        const columns = colMatch[1].split(",").map(s => s.trim());
        if (columns.length !== Object.keys(bindArgs).length) {
          throw new Error("INSERT column/bind count mismatch");
        }
        const row: Record<string, unknown> = {};
        for (const col of columns) row[col] = bindArgs[col];
        if (!db.has(table)) db.set(table, { rows: [] });
        db.get(table)!.rows.push(row);
        return {
          success: true,
          results: [],
          meta: {
            duration: 0, size_after: 0, rows_read: 0, rows_written: 1,
            last_row_id: 0, changed_db: true, changes: 1,
          },
        };
      }
    }

    // SELECT * FROM
    if (/^select \*/i.test(sql)) {
      const tableMatch = sql.match(/from ([a-zA-Z0-9_]+)/i);
      if (tableMatch) {
        const table = tableMatch[1];
        const rows = db.get(table)?.rows ?? [];
        // WHERE clause (very basic: only supports equality on named binds)
        let filtered = rows;
        const whereMatch = sql.match(/where (.+)$/i);
        if (whereMatch) {
          const cond = whereMatch[1];
          // Before filtering, extract all binds from the WHERE clause and check they exist in bindArgs
          const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
          for (const name of bindNames) {
            if (!(name in bindArgs)) throw new Error(`Missing bind argument: ${name}`);
          }
          filtered = rows.filter(row => matchesWhere(row, cond));
        }
        const results = mode === "first" ? filtered.slice(0, 1) : filtered;
        return {
          success: true,
          results,
          meta: {
            duration: 0, size_after: 0, rows_read: results.length, rows_written: 0,
            last_row_id: 0, changed_db: false, changes: 0,
          },
        };
      }
    }

    // DELETE FROM
    if (/^delete from/i.test(sql)) {
      const tableMatch = sql.match(/delete from ([a-zA-Z0-9_]+)/i);
      if (tableMatch) {
        const table = tableMatch[1];
        const rows = db.get(table)?.rows ?? [];
        let toDelete: D1Row[] = [];
        const whereMatch = sql.match(/where (.+)$/i);
        if (whereMatch) {
          const cond = whereMatch[1];
          // Before filtering, extract all binds from the WHERE clause and check they exist in bindArgs
          const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
          for (const name of bindNames) {
            if (!(name in bindArgs)) throw new Error(`Missing bind argument: ${name}`);
          }
          toDelete = rows.filter(row => matchesWhere(row, cond));
        } else {
          toDelete = rows;
        }
        db.set(table, { rows: rows.filter(r => !toDelete.includes(r)) });
        return {
          success: true,
          results: [],
          changes: toDelete.length,
          meta: {
            duration: 0, size_after: 0, rows_read: 0, rows_written: 0,
            last_row_id: 0, changed_db: true, changes: toDelete.length,
          },
        };
      }
    }

    // UPDATE <table> SET <col> = :val WHERE <col2> = :val2
    if (/^update [a-zA-Z0-9_]+ set /i.test(sql)) {
      const tableMatch = sql.match(/^update ([a-zA-Z0-9_]+) set /i);
      if (!tableMatch) throw new Error("Malformed UPDATE statement.");
      const table = tableMatch[1];
      const setMatch = sql.match(/set ([a-zA-Z0-9_]+)\s*=\s*:(\w+)/i);
      const whereMatch = sql.match(/where ([a-zA-Z0-9_]+)\s*=\s*:(\w+)/i);
      if (!setMatch || !whereMatch) throw new Error("Only simple UPDATE ... SET col = :val WHERE col2 = :val2 supported.");
      const [, setCol, setBind] = setMatch;
      const [, whereCol, whereBind] = whereMatch;
      if (!(setBind in bindArgs)) throw new Error(`Missing bind argument: ${setBind}`);
      if (!(whereBind in bindArgs)) throw new Error(`Missing bind argument: ${whereBind}`);
      const tableObj = db.get(table);
      if (!tableObj) throw new Error(`Table not found: ${table}`);
      let changes = 0;
      for (const row of tableObj.rows) {
        if (row[whereCol] === bindArgs[whereBind]) {
          row[setCol] = bindArgs[setBind];
          changes++;
        }
      }
      return {
        success: true,
        results: [],
        meta: {
          duration: 0,
          size_after: 0,
          rows_read: changes,
          rows_written: changes,
          last_row_id: 0,
          changed_db: changes > 0,
          changes,
        },
      };
    }

    // Default: throw for unsupported SQL
    throw new Error("SQL query uses unsupported syntax or features in this mock database.");
  }

  return {
    bind(args: Record<string, unknown>) {
      bindArgs = args;
      return this;
    },
    async run() { return parseAndRun("run"); },
    async all() { return parseAndRun("all"); },
    async first() { return parseAndRun("first"); },
    async raw() {
      const result = await parseAndRun("all");
      return result.results ?? [];
    },
  };
}