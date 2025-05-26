/**
 * @fileoverview
 * Implementation of the MockD1PreparedStatement for mockD1Database.
 * Provides a modular, handler-based mock prepared statement interface.
 */

import { MockD1PreparedStatement } from "../types/MockD1Database";
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
import { d1Error } from './errors.js';
import { makeD1Result } from './resultUtils.js';
import type { FakeD1Result } from "../types/MockD1Database.js";
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
  log.debug('Preparing statement: %s', sql);
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

  // Explicit malformed DML SQL checks at prepare-time
  if (/^\s*select\s+from\b/i.test(sql)) {
    throw d1Error('MALFORMED_SELECT');
  }
  if (/^\s*insert\s+into\b(?!.*values)/i.test(sql)) {
    throw d1Error('MALFORMED_INSERT');
  }
  if (/^\s*delete\s*($|;|\s)/i.test(sql)) {
    throw d1Error('MALFORMED_DELETE');
  }
  if (/^\s*update\s+\S+\s*($|;|\s)/i.test(sql)) {
    throw d1Error('MALFORMED_UPDATE');
  }

  // Validate for malformed SQL at prepare-time for DML (SELECT, INSERT, DELETE, UPDATE)
  if (/^\s*select\b/i.test(sql) || /^\s*insert\b/i.test(sql) || /^\s*delete\b/i.test(sql) || /^\s*update\b/i.test(sql)) {
    validateSqlOrThrow(sql, { skipMalformed: false });
  } else {
    // Only validate for unsupported SQL, not malformed SQL (malformed errors must be thrown at run-time)
    validateSqlOrThrow(sql, { skipMalformed: true });
  }

  // Defensive: ensure all tables in db have a valid columns array
  for (const table of db.values()) {
    if (!Array.isArray(table.columns)) {
      table.columns = [];
    }
  }

  let bindArgs: Record<string, unknown> = {};

  // Do not perform any further validation here. All malformed SQL and missing bind argument errors must be thrown at run-time in the statement handlers.

  /**
   * Parses and executes the SQL statement according to the mode.
   * Delegates to the appropriate statement handler.
   *
   * @param mode - The execution mode: "run", "all", "first", or "raw".
   * @returns The result of the statement execution.
   */
  function parseAndRun(mode: "run" | "all" | "first" | "raw") {
    try {
      log.debug('Executing statement: %s (mode: %s)', sql, mode);
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
    } catch (err: unknown) {
      log.error('[preparedStatement][parseAndRun] caught error', { err, message: (err as Error)?.message, stack: (err as Error)?.stack });
      // Propagate errors for missing bind arguments and malformed SQL as-is
      if (
        err &&
        typeof (err as Error).message === 'string' &&
        (/Missing bind argument/i.test((err as Error).message) ||
         (err as Error).message.includes('Malformed'))
      ) {
        log.error('[preparedStatement][parseAndRun] propagating error as-is', { message: (err as Error).message });
        throw err;
      }
      // Propagate D1 errors for unsupported/table/column errors as-is
      if (
        err &&
        typeof (err as Error).message === 'string' &&
        (/Unsupported|Table does not exist|Column does not exist/.test((err as Error).message))
      ) {
        log.error('[preparedStatement][parseAndRun] propagating D1 error as-is', { message: (err as Error).message });
        throw err;
      }
      log.error('[preparedStatement][parseAndRun] wrapping error as GENERIC', { message: (err as Error)?.message });
      // For all other errors, wrap as a generic D1 error
      throw d1Error('GENERIC');
    }
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
    async run(_args?: unknown): Promise<FakeD1Result<unknown>> {
      try {
        const result = parseAndRun("run");
        log.debug('[run] result', { result });
        if (!result || typeof result !== 'object' || !('results' in result && 'success' in result && 'meta' in result)) {
          // Defensive: always return a valid FakeD1Result shape
          return makeD1Result([], {
            duration: 0,
            size_after: 0,
            rows_read: 0,
            rows_written: 0,
            last_row_id: 0,
            changed_db: false,
            changes: 0
          });
        }
        if (result.success === false) {
          log.error('[preparedStatement][run] result.success === false, throwing GENERIC');
          throw d1Error('GENERIC');
        }
        return result as FakeD1Result;
      } catch (err: unknown) {
        log.error('[preparedStatement][run] caught error', { err, message: (err as Error)?.message, stack: (err as Error)?.stack });
        if (
          err &&
          typeof (err as Error).message === 'string' &&
          /Missing bind argument/i.test((err as Error).message)
        ) {
          log.error('[preparedStatement][run] propagating missing bind argument error', { message: (err as Error).message });
          throw err;
        }
        // Propagate D1 errors as-is for Malformed/Unsupported/Table/Column errors
        if (
          err &&
          typeof (err as Error).message === 'string' &&
          /Malformed|Unsupported|Table does not exist|Column does not exist/.test((err as Error).message)
        ) {
          log.error('[preparedStatement][run] propagating D1 error as-is', { message: (err as Error).message });
          throw err;
        }
        log.error('[preparedStatement][run] wrapping error as GENERIC', { message: (err as Error)?.message });
        // For all other errors, wrap as a generic D1 error
        throw d1Error('GENERIC');
      }
    },
    /**
     * Executes the statement and returns all matching results.
     * @returns The result of the statement execution.
     */
    async all(_args?: unknown): Promise<FakeD1Result<unknown>> {
      try {
        const result = parseAndRun("all");
        log.debug('[all] result', { result });
        if (!result || typeof result !== 'object' || !('results' in result && 'success' in result && 'meta' in result)) {
          return makeD1Result([], {
            duration: 0,
            size_after: 0,
            rows_read: 0,
            rows_written: 0,
            last_row_id: 0,
            changed_db: false,
            changes: 0
          });
        }
        if (result.success === false) {
          throw d1Error('GENERIC');
        }
        return result as FakeD1Result;
      } catch (err: unknown) {
        log.error('[preparedStatement][all] caught error', { err, message: (err as Error)?.message, stack: (err as Error)?.stack });
        if (
          err &&
          typeof (err as Error).message === 'string' &&
          /Missing bind argument/i.test((err as Error).message)
        ) {
          log.error('[preparedStatement][all] propagating missing bind argument error', { message: (err as Error).message });
          throw err;
        }
        if (
          err &&
          typeof (err as Error).message === 'string' &&
          /Malformed|Unsupported|Table does not exist|Column does not exist/.test((err as Error).message)
        ) {
          log.error('[preparedStatement][all] propagating D1 error as-is', { message: (err as Error).message });
          throw err;
        }
        log.error('[preparedStatement][all] wrapping error as GENERIC', { message: (err as Error)?.message });
        throw d1Error('GENERIC');
      }
    },
    /**
     * Executes the statement and returns the first matching result.
     * @returns The result of the statement execution.
     */
    async first(_args?: unknown): Promise<FakeD1Result<unknown>> {
      try {
        const result = parseAndRun("first");
        log.debug('[first] result', { result });
        if (!result || typeof result !== 'object' || !('results' in result && 'success' in result && 'meta' in result)) {
          return makeD1Result([], {
            duration: 0,
            size_after: 0,
            rows_read: 0,
            rows_written: 0,
            last_row_id: 0,
            changed_db: false,
            changes: 0
          });
        }
        if (result.success === false) {
          throw d1Error('GENERIC');
        }
        return result as FakeD1Result;
      } catch (err: unknown) {
        log.error('[preparedStatement][first] caught error', { err, message: (err as Error)?.message, stack: (err as Error)?.stack });
        if (
          err &&
          typeof (err as Error).message === 'string' &&
          /Missing bind argument/i.test((err as Error).message)
        ) {
          log.error('[preparedStatement][first] propagating missing bind argument error', { message: (err as Error).message });
          throw err;
        }
        if (
          err &&
          typeof (err as Error).message === 'string' &&
          /Malformed|Unsupported|Table does not exist|Column does not exist/.test((err as Error).message)
        ) {
          log.error('[preparedStatement][first] propagating D1 error as-is', { message: (err as Error).message });
          throw err;
        }
        log.error('[preparedStatement][first] wrapping error as GENERIC', { message: (err as Error)?.message });
        throw d1Error('GENERIC');
      }
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