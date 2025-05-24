/**
 * @file helpers/mockInjectTableRows.ts
 * @description Test-only utility for injecting rows into a mock D1 database table.
 * @warning This is for test/mocking purposes only and should not be used in production code.
 */

import { validateRowAgainstSchema, normalizeRowToSchema } from '../engine/tableUtils/schemaUtils.js';
import { log } from '@variablesoftware/logface';
import type { MockD1TableColumn } from '../types/MockD1Database.js';

/**
 * Injects rows into a table in the mock D1 database (test helper only).
 * Requires explicit columns (no inference from data).
 * Throws if extra columns are present in injected rows.
 * @param db - The database Map.
 * @param tableName - The table name.
 * @param columns - The table schema columns (explicit, never inferred).
 * @param rows - The rows to inject.
 */
export function injectTableRows(
  db: Map<string, { rows: Record<string, unknown>[]; columns: MockD1TableColumn[] }>,
  tableName: string,
  columns: MockD1TableColumn[],
  rows: Record<string, unknown>[]
): void {
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('[injectTableRows] called', { tableName, columns, rows });
  }
  if (!tableName || typeof tableName !== 'string' || tableName.trim() === '') {
    log.debug('[injectTableRows] invalid tableName', { tableName });
    throw new Error('Table name must be a non-empty string');
  }
  if (!Array.isArray(rows)) {
    log.debug('[injectTableRows] rows not array', { rows });
    throw new Error('Rows must be an array');
  }
  if (!Array.isArray(columns) || columns.length === 0) {
    log.debug('[injectTableRows] columns not array or empty', { columns });
    throw new Error('Columns must be a non-empty array');
  }

  const normalizedTableName = tableName.toLowerCase();
  let table = db.get(normalizedTableName);

  if (!table) {
    log.debug('[injectTableRows] creating new table', { normalizedTableName, columns });
    db.set(normalizedTableName, {
      rows: [],
      columns,
    });
    table = db.get(normalizedTableName);
  } else {
    // Overwrite columns if table exists and columns differ
    if (JSON.stringify(table.columns) !== JSON.stringify(columns)) {
      log.debug('[injectTableRows] overwriting table columns', { normalizedTableName, columns });
      table.columns = columns;
      table.rows = [];
    }
  }

  const tableRows = db.get(normalizedTableName)!.rows;
  if (rows.length === 0) {
    log.debug('[injectTableRows] clearing table rows', { normalizedTableName });
    db.set(normalizedTableName, { rows: [], columns });
    return;
  }
  for (const row of rows) {
    log.debug('[injectTableRows] validating and normalizing row', { row, columns });
    validateRowAgainstSchema(columns, row);
    const normalizedRow = normalizeRowToSchema(columns, row);
    log.debug('[injectTableRows] normalized row', { normalizedRow });
    tableRows.push(normalizedRow);
  }
}