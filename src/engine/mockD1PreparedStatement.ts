/**
 * @fileoverview
 * Implementation of the MockD1PreparedStatement for mockD1Database.
 * Provides a modular, handler-based mock prepared statement interface.
 */

import { D1Row, MockD1PreparedStatement } from "../types/MockD1Database";
import { log } from "@variablesoftware/logface";
import { handleUpdate } from "./statementHandlers/handleUpdate";
import { handleInsert } from "./statementHandlers/handleInsert";
import { handleSelect } from "./statementHandlers/handleSelect";
import { matchesWhere } from "./whereMatcher";
import { handleDelete } from "./statementHandlers/handleDelete";
import { handleCreateTable } from "./statementHandlers/handleCreateTable";
import { isSupportedSQL } from "../helpers/mockD1Helpers";
import { handleDropTable } from "./statementHandlers/handleDropTable";
import { handleTruncateTable } from "./statementHandlers/handleTruncateTable";
import { handleAlterTableAddColumn } from "./statementHandlers/handleAlterTableAddColumn";

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
  _logger: ReturnType<typeof log>
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
      return handleSelect(sql, db, bindArgs, matchesWhere, mode === "first" ? "first" : "all");
    }

    // SELECT COUNT(*) FROM
    if (/^select count\(\*\) from/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, matchesWhere, mode);
    }

    // SELECT <columns> FROM <table>
    if (/^select [\w,\s]+ from [a-zA-Z0-9_]+/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, matchesWhere, mode);
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