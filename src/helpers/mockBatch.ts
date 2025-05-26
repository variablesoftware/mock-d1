import { FakeD1Result, MockD1PreparedStatement } from '../types/MockD1Database.js';

/**
 * @file helpers/mockBatch.ts
 * @description Provides the mock-only `batch` method for mockD1Database.
 * @warning This is a mock/test-only API. Do not use in production. Will emit a warning if called outside test.
 */

/**
 * Executes multiple prepared statements in parallel (mock only).
 * Emits a warning if used outside of test environments.
 * @param statements - Array of prepared statements.
 * @returns Promise resolving to an array of FakeD1Result objects.
 */
export async function mockBatch<T = unknown>(statements: MockD1PreparedStatement[]): Promise<FakeD1Result<T>[]> {
  console.warn('mockBatch() is a mock/test-only API and should not be used in production.');
  // For each statement, call run() and collect the results
  const results: FakeD1Result<T>[] = [];
  for (const stmt of statements) {
    // Defensive: ensure stmt has a run method
    if (typeof stmt.run === 'function') {
      // @ts-expect-error: run() may not be strictly typed, but we expect FakeD1Result
      results.push(await stmt.run());
    } else {
      // If not a valid statement, push a dummy result
      results.push({
        results: [],
        success: false,
        meta: {
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      });
    }
  }
  return results;
}
