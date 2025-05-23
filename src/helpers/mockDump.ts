/**
 * @file helpers/mockDump.ts
 * @description Provides the mock-only `dump` method for mockD1Database.
 * @warning This is a mock/test-only API. Do not use in production. Will emit a warning if called outside test.
 */
import { D1Row } from '../types/MockD1Database.js';

/**
 * Returns a snapshot of the current database state (mock only).
 * Emits a warning if used outside of test environments.
 * @param db - The internal Map of tables to rows.
 * @returns An object mapping table names to their rows.
 */
export function mockDump(db: Map<string, { rows: D1Row[] }>): Record<string, { rows: D1Row[] }> {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn('[mock-d1] Warning: mockDump() is a mock/test-only API and should not be used in production.');
  }
  return Object.fromEntries(db.entries());
}
