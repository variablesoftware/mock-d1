/**
 * @file engine/tableUtils/tableLookup.ts
 * @description Utilities for D1-like table and column lookup (case-insensitive, D1-compatible).
 */

import { log } from '@variablesoftware/logface';
log.options({tag:`VITEST_POOL_ID: ${process.env.VITEST_POOL_ID}, VITEST_WORKER_ID: ${process.env.VITEST_WORKER_ID}}`})

/**
 * Finds the canonical table key in the database Map, case-insensitively (D1-compatible).
 * @param db - The database Map.
 * @param tableName - The table name to look up.
 * @returns The canonical table key if found, or undefined.
 */
export function findTableKey(db: Map<string, any>, tableName: string): string | undefined {
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('[findTableKey] called', { dbKeys: Array.from(db.keys()), tableName });
  }
  const lower = tableName.toLowerCase();
  for (const key of db.keys()) {
    if (key.toLowerCase() === lower) {
      if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
        log.debug('[findTableKey] match', { key, tableName });
      }
      return key;
    }
  }
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('[findTableKey] not found', { tableName });
  }
  return undefined;
}

/**
 * Finds the canonical column key in a schema, case-insensitively (D1-compatible).
 * @param columns - The schema columns array.
 * @param columnName - The column name to look up.
 * @returns The canonical column key if found, or undefined.
 */
export function findColumnKey(columns: { name: string; quoted: boolean }[], columnName: string): string | undefined {
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('[findColumnKey] called', { columns, columnName });
  }
  const lower = columnName.toLowerCase();
  for (const col of columns) {
    if ((col.quoted ? col.name : col.name.toLowerCase()) === lower) {
      log.debug('[findColumnKey] match', { col, columnName });
      return col.name;
    }
    if (col.name.toLowerCase() === lower) {
      log.debug('[findColumnKey] match', { col, columnName });
      return col.name;
    }
  }
  log.debug('[findColumnKey] not found', { columnName });
  return undefined;
}
