/**
 * @file helpers/mockDump.ts
 * @description Provides the mock-only `dump` method for mockD1Database.
 * @warning This is a mock/test-only API. Do not use in production. Will emit a warning if called outside test.
 */
import { D1TableData } from '../types/MockD1Database.js';
import { log } from '@variablesoftware/logface';

/**
 * Returns a snapshot of the current database state (mock only).
 * Emits a warning if used outside of test environments.
 * @param db - The internal Map of tables to rows.
 * @returns An object mapping table names to their rows.
 */
export function mockDump(db: Map<string, D1TableData>): string {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    log.warn('mockDump() is a mock/test-only API and should not be used in production.');
  }
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('called', { dbKeys: Array.from(db.keys()) });
    log.debug('db snapshot', Object.fromEntries(db.entries()));
  }
  // Return a stringified dump for test compatibility
  return JSON.stringify(Object.fromEntries(db.entries()), null, 2);
}
