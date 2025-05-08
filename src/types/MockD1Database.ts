/**
 * @file types/MockD1Database.ts
 * @description Shared types for the MockD1Database engine and helpers.
 *
 * Provides minimal and test-optimized D1 type definitions.
 */

/**
 * Represents a single row in a mock D1 database table.
 * Each key is a column name, and the value is the cell value.
 */
export interface D1Row {
  [key: string]: unknown;
}

/**
 * Represents the result of a D1 database operation.
 *
 * @template T - The type of each result row.
 * @property results - The array of result rows.
 * @property success - Whether the operation was successful.
 * @property meta - Metadata about the operation.
 */
export interface FakeD1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    /** Duration of the operation in milliseconds. */
    duration: number;
    /** Size of the database after the operation. */
    size_after: number;
    /** Number of rows read. */
    rows_read: number;
    /** Number of rows written. */
    rows_written: number;
    /** The last inserted row ID, if applicable. */
    last_row_id: number;
    /** Whether the database was changed by the operation. */
    changed_db: boolean;
    /** Number of rows changed by the operation. */
    changes: number;
  };
}

/**
 * Represents a prepared statement in the mock D1 database.
 */
export interface MockD1PreparedStatement {
  /**
   * Binds arguments to the prepared statement.
   * @param _args - The named bind arguments.
   * @returns The prepared statement instance for chaining.
   */
  bind(_args: Record<string, unknown>): MockD1PreparedStatement;

  /**
   * Executes the statement and returns the result.
   * @returns A promise resolving to the result of the statement execution.
   */
  run(): Promise<FakeD1Result>;

  /**
   * Executes the statement and returns all matching results.
   * @returns A promise resolving to the result of the statement execution.
   */
  all(): Promise<FakeD1Result>;

  /**
   * Executes the statement and returns the first matching result.
   * @returns A promise resolving to the result of the statement execution.
   */
  first(): Promise<FakeD1Result>;

  /**
   * Executes the statement and returns the raw result array.
   * @returns A promise resolving to the array of result rows.
   */
  raw(): Promise<unknown[]>;
}
