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
import { validateSQLSyntax } from "./sqlValidation.js";
import { matchesWhere } from "./helpers.js";

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
  // log.debug('Preparing statement: %s', sql);
  // Reject multiple SQL statements in one string
  if (/;/.test(sql.trim().replace(/;$/, ''))) {
    throw new Error("Multiple SQL statements in one string are not supported.");
  }
  // Throw on unsupported SQL at prepare-time (D1 behavior)
  if (
    /\blike\b/i.test(sql) ||
    /\bbetween\b/i.test(sql) ||
    /\bjoin\b/i.test(sql)
  ) {
    throw new Error("Unsupported SQL syntax in mockD1Database: LIKE, BETWEEN, JOIN not implemented.");
  }

  // Strict SQL validation for malformed statements at prepare-time
  const upperSql = sql.trim().toUpperCase();
  // Accept SQL keywords as table/column names by relaxing regexes
  if (upperSql.startsWith("CREATE TABLE")) {
    // CREATE TABLE <name> (<columns>) must have at least one column
    // Match: CREATE TABLE <name> ( ... )
    const match = /^CREATE TABLE\s+\S+\s*\((.*)\)/i.exec(sql);
    if (match) {
      const columns = match[1].trim();
      // If columns is empty or only whitespace, throw
      if (!columns || /^\s*$/.test(columns)) {
        throw new Error("Syntax error: CREATE TABLE must define at least one column");
      }
    }
  }
  if (upperSql.startsWith("SELECT")) {
    // SELECT must have at least: SELECT <columns> FROM <table>
    if (!/^SELECT\s+.+\s+FROM\s+\S+/i.test(sql)) {
      throw new Error("Malformed SELECT statement");
    }
  } else if (upperSql.startsWith("INSERT")) {
    // INSERT must have: INSERT INTO <table> (<cols>) VALUES (<vals>)
    if (!/^INSERT INTO \S+ \(.*\) VALUES \(.*\)/i.test(sql)) {
      throw new Error("Malformed INSERT statement");
    }
  } else if (upperSql.startsWith("DELETE")) {
    // DELETE must have: DELETE FROM <table>
    if (!/^DELETE FROM \S+/i.test(sql)) {
      throw new Error("Malformed DELETE statement");
    }
  } else if (!isSupportedSQL(sql)) {
    throw new Error(`Malformed SQL statement: ${upperSql.split(' ')[0]}`);
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
    // log.debug('Executing statement: %s (mode: %s)', sql, mode);
    // Use the original SQL for all handler calls
    if (/^create table/i.test(sql)) {
      return handleCreateTable(sql, db);
    }

    // INSERT INTO
    if (/^insert into/i.test(sql)) {
      return handleInsert(sql, db, bindArgs);
    }

    // SELECT * FROM
    if (/^select \*/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, matchesWhere, mode === 'first' ? 'first' : 'all');
    }

    // SELECT COUNT(*) FROM
    if (/^select count\(\*\) from/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, matchesWhere, mode === 'first' ? 'first' : 'all');
    }

    // SELECT <columns> FROM <table>
    if (/^select [^*]+ from \S+/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, matchesWhere, mode === 'first' ? 'first' : 'all');
    }

    // DELETE FROM
    if (/^delete from/i.test(sql)) {
      return handleDelete(sql, db, bindArgs);
    }

    // UPDATE <table> SET <col> = :val WHERE <col2> = :val2
    if (/^update \S+ set /i.test(sql)) {
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
    if (/^alter table \S+ add column/i.test(sql)) {
      return handleAlterTableAddColumn(sql, db);
    }

    // Default: throw for unsupported SQL
    throw new Error(`Malformed SQL statement: ${sql.trim().split(' ')[0].toUpperCase()}`);
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