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
export interface D1Result {
  success: boolean;
  changes?: number;
}
