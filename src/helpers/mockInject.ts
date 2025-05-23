/**
 * @file helpers/mockInject.ts
 * @description Provides the mock-only `inject` method for mockD1Database.
 * @warning This is a mock/test-only API. Do not use in production. Will emit a warning if called outside test.
 */
import { D1Row } from '../types/MockD1Database.js';
import { injectTableRows } from './mockInjectTableRows.js';

/**
 * Injects rows into a table in the mock D1 database (mock only).
 * Emits a warning if used outside of test environments.
 * @param db - The internal Map of tables to rows.
 * @param tableName - The table name.
 * @param rows - The rows to inject.
 */
export function mockInject(
  db: Map<string, { rows: D1Row[] }>,
  tableName: string,
  rows: Record<string, unknown>[]
): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn('[mock-d1] Warning: mockInject() is a mock/test-only API and should not be used in production.');
  }
  injectTableRows(db, tableName, rows);
}
