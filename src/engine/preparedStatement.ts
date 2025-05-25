/**
 * @fileoverview
 * Implementation of the MockD1PreparedStatement for mockD1Database.
 * Provides a modular, handler-based mock prepared statement interface.
 */

import { D1Row, MockD1PreparedStatement } from "../types/MockD1Database";
import type { D1TableData } from "../types/MockD1Database";
import { handleUpdate } from "./statementHandlers/handleUpdate.js";
import { handleInsert } from "./statementHandlers/handleInsert.js";
import { handleSelect } from "./statementHandlers/handleSelect.js";
import { handleDelete } from "./statementHandlers/handleDelete.js";
import { handleCreateTable } from "./statementHandlers/handleCreateTable.js";
// Removed isSupportedSQL import; use centralized SQL validation instead.
import { handleDropTable } from "./statementHandlers/handleDropTable.js";
import { handleTruncateTable } from "./statementHandlers/handleTruncateTable.js";
import { handleAlterTableAddColumn } from "./statementHandlers/handleAlterTableAddColumn.js";
import { handleAlterTableDropColumn } from './statementHandlers/handleAlterTableDropColumn.js';
import { log } from "@variablesoftware/logface";
import { validateSqlOrThrow } from './sqlValidation.js';
import { d1Error, D1_ERRORS } from './errors.js';
// log import removed (was unused)
// validateSQLSyntax import removed (was unused)
// Removed unused 'Logger' interface

/**
 * Creates a mock prepared statement for the given SQL and database state.
 *
 * @param sql - The SQL statement string.
 * @param db - The in-memory database map.
 * @returns A mock prepared statement implementing the D1 interface.
 * @throws If the SQL is malformed or unsupported.
 */
export function createPreparedStatement(
  sql: string,
  db: Map<string, D1TableData>
): MockD1PreparedStatement {
  // log.debug('Preparing statement: %s', sql);
  // Reject multiple SQL statements in one string
  if (/;/.test(sql.trim().replace(/;$/, ''))) {
    throw d1Error('MULTI_STATEMENT');
  }
  // Throw on unsupported SQL at prepare-time (D1 behavior)
  if (
    /\blike\b/i.test(sql) ||
    /\bbetween\b/i.test(sql) ||
    /\bjoin\b/i.test(sql)
  ) {
    throw d1Error('UNSUPPORTED_SQL');
  }

  // Only validate for unsupported SQL, not malformed SQL (malformed errors must be thrown at run-time)
  // Fix: Do not throw on missing bind arguments at prepare-time, only at run-time in handlers
  // Patch: Do not throw for missing bind arguments at prepare-time for INSERT/SELECT/UPDATE/DELETE
  // Only check for unsupported SQL and skip malformed/missing bind errors here
  validateSqlOrThrow(sql, { skipMalformed: true });

  // Defensive: ensure all tables in db have a valid columns array
  for (const table of db.values()) {
    if (!Array.isArray(table.columns)) {
      table.columns = [];
    }
  }

  let bindArgs: Record<string, unknown> = {};

  const upperSql = sql.trim().toUpperCase();
  // Accept SQL keywords as table/column names by relaxing regexes
  if (upperSql.startsWith("CREATE ")) {
    // Only CREATE TABLE is supported; all others are unsupported
    if (!upperSql.startsWith("CREATE TABLE")) {
      throw d1Error('UNSUPPORTED_SQL');
    }
    // CREATE TABLE <name> (<columns>)
    const match = /^CREATE TABLE\s+\S+\s*\((.*)\)/i.exec(sql);
    if (!match) {
      // For malformed CREATE TABLE, throw UNSUPPORTED_SQL to match test expectations
      throw d1Error('UNSUPPORTED_SQL');
    }
  }
  if (upperSql.startsWith("SELECT")) {
    // SELECT must have at least: SELECT <columns> FROM <table>
    if (!/^SELECT\s+.+\s+FROM\s+\S+/i.test(sql)) {
      throw d1Error('MALFORMED_SELECT');
    }
  } else if (upperSql.startsWith("INSERT")) {
    // INSERT must have: INSERT INTO <table> (<cols>) VALUES (<vals>)
    if (!/^INSERT INTO \S+ \(.*\) VALUES \(.*\)/i.test(sql)) {
      throw d1Error('MALFORMED_INSERT');
    }
    // Parse columns and values for further validation
    const colMatch = sql.match(/insert into\s+([`"])?(\w+)\1?(?:\s*\(([^)]*)\))?/i);
    const valuesMatch = sql.match(/values\s*\(([^)]+)\)/i);
    if (colMatch && valuesMatch) {
      const columns = colMatch[3]
        ? colMatch[3].split(",").map(s => s.trim())
        : [];
      const values = valuesMatch[1]
        ? valuesMatch[1].split(",").map(s => s.trim())
        : [];
      // Check for column/value count mismatch
      if (columns.length !== values.length || columns.length === 0) {
        throw d1Error('MALFORMED_INSERT');
      }
      // Check for duplicate column names (case-insensitive for unquoted, exact for quoted)
      const seenUnquoted = new Set<string>();
      const seenQuoted = new Set<string>();
      for (const col of columns) {
        const quotedMatch = col.match(/^([`"\[])(.+)\1/);
        if (quotedMatch) {
          const name = quotedMatch[2];
          if (seenQuoted.has(name)) {
            throw d1Error('MALFORMED_INSERT', 'Duplicate column name in INSERT');
          }
          seenQuoted.add(name);
        } else {
          const lower = col.toLowerCase();
          if (seenUnquoted.has(lower)) {
            throw d1Error('MALFORMED_INSERT', 'Duplicate column name in INSERT');
          }
          seenUnquoted.add(lower);
        }
      }
      // Do NOT check for missing bind arguments here; let the handler throw at run-time
    }
  } else if (upperSql.startsWith("DELETE")) {
    // DELETE must have: DELETE FROM <table>
    if (!/^DELETE FROM \S+/i.test(sql)) {
      throw d1Error('MALFORMED_DELETE');
    }
  } else if (upperSql.startsWith("UPDATE")) {
    // UPDATE must have: UPDATE <table> SET <col> = <val>
    if (!/^UPDATE\s+\S+\s+SET\s+.+/i.test(sql)) {
      throw d1Error('MALFORMED_UPDATE');
    }
  }

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
      return handleSelect(sql, db, bindArgs, mode === 'first' ? 'first' : 'all');
    }

    // SELECT COUNT(*) FROM
    if (/^select count\(\*\) from/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, mode === 'first' ? 'first' : 'all');
    }

    // SELECT <columns> FROM <table>
    if (/^select [^*]+ from \S+/i.test(sql)) {
      return handleSelect(sql, db, bindArgs, mode === 'first' ? 'first' : 'all');
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

    // ALTER TABLE DROP COLUMN
    if (/^alter table \S+ drop column /i.test(sql)) {
      return handleAlterTableDropColumn();
    }

    // Default: throw for unsupported SQL
    throw d1Error('UNSUPPORTED_SQL');
  }

  return {
    /**
     * Binds arguments to the prepared statement.
     * @param _args - The named bind arguments.
     * @returns The prepared statement instance for chaining.
     */
    bind(_args: Record<string, unknown>) {
      bindArgs = _args;
      return this;
    },
    /**
     * Executes the statement and returns the result.
     * @returns The result of the statement execution.
     */
    async run(_args?: unknown) {
      const result = parseAndRun("run");
      if (!result) throw new Error("Handler did not return a result object");
      return result;
    },
    /**
     * Executes the statement and returns all matching results.
     * @returns The result of the statement execution.
     */
    async all(_args?: unknown) {
      const result = parseAndRun("all");
      if (!result) throw new Error("Handler did not return a result object");
      return result;
    },
    /**
     * Executes the statement and returns the first matching result.
     * @returns The result of the statement execution.
     */
    async first(_args?: unknown) {
      const result = parseAndRun("first");
      if (!result) throw new Error("Handler did not return a result object");
      return result;
    },
    /**
     * Executes the statement and returns the raw result array.
     * 
     * @remarks
     * This method is only available in the mock implementation.
     * It is NOT part of the official D1 API.
     * Provided for test and inspection convenience only.
     * 
     * @returns The array of result rows.
     */
    async raw(_args?: unknown) {
      // Use log.warn directly for the mock-only API warning
      log.warn(
        '[mock-d1] Warning: .raw() is a mock-only API and not part of the official D1 interface.'
      );
      let result;
      try {
        result = parseAndRun("all");
      } catch {
        // If parseAndRun throws (e.g., table does not exist), treat as no results
        return [];
      }
      if (!result || !('results' in result) || !Array.isArray(result.results)) {
        return [];
      }
      // Filter out rows where all values are undefined (header row)
      return result.results.filter(
        (row: Record<string, unknown>) =>
          Object.values(row).some((v) => v !== undefined)
      );
    },
  };
}