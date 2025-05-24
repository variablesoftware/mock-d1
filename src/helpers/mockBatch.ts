/**
 * @file helpers/mockBatch.ts
 * @description Provides the mock-only `batch` method for mockD1Database.
 * @warning This is a mock/test-only API. Do not use in production. Will emit a warning if called outside test.
 */
import { MockD1PreparedStatement, FakeD1Result } from '../types/MockD1Database.js';
import { log } from '@variablesoftware/logface';

/**
 * Executes multiple prepared statements in parallel (mock only).
 * Emits a warning if used outside of test environments.
 * @param statements - Array of prepared statements.
 * @returns Promise resolving to an array of results.
 */
export async function mockBatch(_statements: unknown[]): Promise<unknown[]> {
  console.warn('mockBatch() is a mock/test-only API and should not be used in production.');
  return [];
}
