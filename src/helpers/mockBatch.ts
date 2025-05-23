/**
 * @file helpers/mockBatch.ts
 * @description Provides the mock-only `batch` method for mockD1Database.
 * @warning This is a mock/test-only API. Do not use in production. Will emit a warning if called outside test.
 */
import { MockD1PreparedStatement, FakeD1Result } from '../types/MockD1Database.js';

/**
 * Executes multiple prepared statements in parallel (mock only).
 * Emits a warning if used outside of test environments.
 * @param statements - Array of prepared statements.
 * @returns Promise resolving to an array of results.
 */
export async function mockBatch<T = unknown>(statements: MockD1PreparedStatement[]): Promise<FakeD1Result<T>[]> {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn('[mock-d1] Warning: mockBatch() is a mock/test-only API and should not be used in production.');
  }
  return Promise.all(statements.map(stmt => stmt.run() as Promise<FakeD1Result<T>>));
}
