/**
 * @file types/MockD1Database.ts
 * @description Shared types for the MockD1Database engine and helpers.
 *
 * Provides minimal and test-optimized D1 type definitions.
 */

/**
 * Represents a single row in a mock D1 database table.
 */
export interface D1Row {
  [key: string]: unknown;
}

/**
 * Represents the result of a D1 database operation.
 */
export interface FakeD1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    size_after: number;
    rows_read: number;
    rows_written: number;
    last_row_id: number;
    changed_db: boolean;
    changes: number;
  };
}

/**
 * Represents a prepared statement in the mock D1 database.
 */
export interface MockD1PreparedStatement {
  bind(_args: Record<string, unknown>): MockD1PreparedStatement;
  run(): Promise<FakeD1Result>;
  all(): Promise<FakeD1Result>;
  first(): Promise<FakeD1Result>;
  raw(): Promise<unknown[]>;
}
