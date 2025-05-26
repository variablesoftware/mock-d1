/**
 * @file helpers/mockInject.ts
 * @description Provides the mock-only `inject` method for mockD1Database.
 * @warning This is a mock/test-only API. Do not use in production. Will emit a warning if called outside test.
 */
import { D1TableData } from '../types/MockD1Database.js';
import { injectTableRows } from './injectTableRows.js';
import { log } from '@variablesoftware/logface';
import type { MockD1TableColumn } from '../types/MockD1Database.js';

/**
 * Injects rows into a table in the mock D1 database (mock only).
 * Emits a warning if used outside of test environments.
 * @param db - The internal Map of tables to rows.
 * @param tableName - The table name.
 * @param columns - The explicit table schema columns (required).
 * @param rows - The rows to inject.
 */
export function mockInject(
  db: Map<string, D1TableData>,
  tableName: string,
  columns: MockD1TableColumn[],
  rows: Record<string, unknown>[]
): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    log.warn('mockInject() is a mock/test-only API and should not be used in production.');
  }
  // Debug output for test troubleshooting
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('called with:', { tableName, columns, rows });
    log.debug('db keys before:', Array.from(db.keys()));
  }
  injectTableRows(db, tableName, columns, rows);
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('db keys after:', Array.from(db.keys()));
    log.debug('table after:', db.get(tableName));
  }
}
