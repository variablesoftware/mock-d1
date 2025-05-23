/**
 * @file engine/tableUtils/schemaUtils.ts
 * @description Centralized schema validation and normalization for D1 mock.
 */
import { d1Error, D1_ERRORS } from '../errors.js';

/**
 * Validates a row against a schema (D1-compatible).
 * Throws if extra columns are present or required columns are missing.
 * @param schemaRow - The schema row (object with column names as keys).
 * @param row - The row to validate.
 */
export function validateRowAgainstSchema(schemaRow: Record<string, unknown>, row: Record<string, unknown>): void {
  const schemaCols = Object.keys(schemaRow);
  const rowCols = Object.keys(row);
  // Extra columns
  const extra = rowCols.filter(k => !schemaCols.some(s => s.toLowerCase() === k.toLowerCase()));
  if (extra.length > 0) {
    throw d1Error('EXTRA_COLUMNS', extra.join(', '));
  }
  // Missing columns (D1: missing columns are set to null, not error)
}

/**
 * Normalizes a row to match the schema (D1-compatible).
 * Fills missing columns with null.
 * @param schemaRow - The schema row (object with column names as keys).
 * @param row - The row to normalize.
 * @returns Normalized row.
 */
export function normalizeRowToSchema(schemaRow: Record<string, unknown>, row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const col of Object.keys(schemaRow)) {
    const matchKey = Object.keys(row).find(k => k.toLowerCase() === col.toLowerCase());
    normalized[col] = matchKey ? row[matchKey] : null;
  }
  return normalized;
}
