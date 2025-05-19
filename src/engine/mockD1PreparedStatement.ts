/**
 * @fileoverview
 * Implementation of the MockD1PreparedStatement for mockD1Database.
 * Provides a modular, handler-based mock prepared statement interface.
 */

import { D1Row, MockD1PreparedStatement } from "../types/MockD1Database";
import { handleUpdate } from "./statementHandlers/handleUpdate.js";
import { handleInsert } from "./statementHandlers/handleInsert.js";
import { handleSelect } from "./statementHandlers/handleSelect.js";
import { handleDelete } from "./statementHandlers/handleDelete.js";
import { handleCreateTable } from "./statementHandlers/handleCreateTable.js";
import { isSupportedSQL } from "../helpers/mockD1Helpers.js";
import { handleDropTable } from "./statementHandlers/handleDropTable.js";
import { handleTruncateTable } from "./statementHandlers/handleTruncateTable.js";
import { handleAlterTableAddColumn } from "./statementHandlers/handleAlterTableAddColumn.js";
import { log } from "@variablesoftware/logface";

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  options?: (options: Record<string, unknown>) => Logger;
}

/**
 * Creates a mock prepared statement for the given SQL and database state.
 *
 * @param sql - The SQL statement string.
 * @param db - The in-memory database map.
 * @param logger - The logger instance.
 * @returns A mock prepared statement implementing the D1 interface.
 * @throws If the SQL is malformed or unsupported.
 */
export function createPreparedStatement(
  sql: string,
  db: Map<string, { rows: D1Row[] }>,
  _logger: Logger | undefined
): MockD1PreparedStatement {
  // Throw on unsupported SQL at prepare-time
  if (
    /\blike\b/i.test(sql) ||
    /\bbetween\b/i.test(sql) ||
    /\bjoin\b/i.test(sql)
  ) {
    throw new Error("Unsupported SQL syntax in mockD1Database: LIKE, BETWEEN, JOIN not implemented.");
  }

  if (!isSupportedSQL(sql)) {
    throw new Error("Malformed or unsupported SQL syntax.");
  }

  let bindArgs: Record<string, unknown> = {};

  /**
   * Parses and executes the SQL statement according to the mode.
   * Delegates to the appropriate statement handler.
   *
   * @param mode - The execution mode: "run", "all", "first", or "raw".
   * @returns The result of the statement execution.
   */
  function parseAndRun(mode: "run" | "all" | "first" | "raw") {
    const validModes: ('all' | 'first')[] = ['all', 'first'];
    const resolvedMode: 'all' | 'first' = validModes.includes(mode as 'all' | 'first') ? (mode as 'all' | 'first') : 'all';

    // CREATE TABLE
    if (/^create table/i.test(sql)) {
      return handleCreateTable(sql, db);
    }

    // INSERT INTO
    if (/^insert into/i.test(sql)) {
      return handleInsert(sql, db, bindArgs);
    }

    // SELECT * FROM
    if (/^select \*/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, matchesWhere, resolvedMode);
    }

    // SELECT COUNT(*) FROM
    if (/^select count\(\*\) from/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, matchesWhere, resolvedMode);
    }

    // SELECT <columns> FROM <table>
    if (/^select [\w,\s]+ from [a-zA-Z0-9_]+/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, matchesWhere, resolvedMode);
    }

    // DELETE FROM
    if (/^delete from/i.test(sql)) {
      return handleDelete(sql, db, bindArgs);
    }

    // UPDATE <table> SET <col> = :val WHERE <col2> = :val2
    if (/^update [a-zA-Z0-9_]+ set /i.test(sql)) {
      return handleUpdate(sql, db, bindArgs);
    }

    // DROP TABLE
    if (/^drop table/i.test(sql)) {
      return handleDropTable(sql, db);
    }

    // TRUNCATE TABLE
    if (/^truncate table/i.test(sql)) {
      return handleTruncateTable(sql, db);
    }

    // ALTER TABLE ADD COLUMN
    if (/^alter table [a-zA-Z0-9_]+ add column/i.test(sql)) {
      return handleAlterTableAddColumn(sql, db);
    }

    // Default: throw for unsupported SQL
    throw new Error("SQL query uses unsupported syntax or features in this mock database.");
  }

  const matchesWhere: (_row: D1Row, _cond: string, _bindArgs?: Record<string, unknown>) => boolean = (_row, _cond, _bindArgs) => {
    if (!_bindArgs || !_cond) return false;

    // Split on OR first (lowest precedence)
    const orGroups = _cond.split(/\s+OR\s+/i);
    for (const group of orGroups) {
      // Each group: split on AND (higher precedence)
      const andConds = group.split(/\s+AND\s+/i);
      const andResult = andConds.every(cond => {
        // Support only equality: key = :bind
        const m = cond.match(/([\w.]+)\s*=\s*:(\w+)/);
        if (!m) return false;
        const [, key, bind] = m;
        return _row[key] === _bindArgs[bind];
      });
      if (andResult) return true; // If any OR group is true, return true
    }
    return false; // None matched
  };

  return {
    /**
     * Binds arguments to the prepared statement.
     * @param args - The named bind arguments.
     * @returns The prepared statement instance for chaining.
     */
    bind(args: Record<string, unknown>) {
      bindArgs = args;
      return this;
    },
    /**
     * Executes the statement and returns the result.
     * @returns The result of the statement execution.
     */
    async run() { return parseAndRun("run"); },
    /**
     * Executes the statement and returns all matching results.
     * @returns The result of the statement execution.
     */
    async all() { return parseAndRun("all"); },
    /**
     * Executes the statement and returns the first matching result.
     * @returns The result of the statement execution.
     */
    async first() { return parseAndRun("first"); },
    /**
     * Executes the statement and returns the raw result array.
     * @returns The array of result rows.
     */
    async raw() {
      const result = await parseAndRun("all");
      return result.results ?? [];
    },
  };
}