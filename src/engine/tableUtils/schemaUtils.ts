/**
 * @file engine/tableUtils/schemaUtils.ts
 * @description Centralized schema validation and normalization for D1 mock.
 */
import { d1Error } from '../errors.js';
import { log } from '@variablesoftware/logface';

/**
 * Validates a row against a schema (D1-compatible).
 * Throws if extra columns are present or required columns are missing.
 * @param columns - The schema columns array.
 * @param row - The row to validate.
 * @returns Result object.
 */
export function validateRowAgainstSchema(columns: { original: string; name: string; quoted: boolean }[], row: Record<string, unknown>): { result: boolean } {
  log.debug('[schemaUtils.validateRowAgainstSchema] ENTRY', { columns, row });
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('[schemaUtils.validateRowAgainstSchema] called', { columns, row });
  }
  const rowCols = Object.keys(row);
  log.debug('[schemaUtils.validateRowAgainstSchema] rowCols', { rowCols });
  log.debug('[schemaUtils.validateRowAgainstSchema] columns', { columns });
  const extra = rowCols.filter(k => {
    let isQuoted = /^".*"$/.test(k);
    let match = false;
    if (isQuoted) {
      // Only match quoted columns with exact name
      const keyName = k.slice(1, -1);
      log.debug('[schemaUtils.validateRowAgainstSchema] quoted keyName', { k, keyName });
      match = columns.some(c => c.quoted && c.name === keyName);
      log.debug('[schemaUtils.validateRowAgainstSchema] quoted key match', { key: k, keyName, match, columns });
    } else {
      // Only match unquoted columns (case-insensitive)
      const keyName = k.toLowerCase();
      log.debug('[schemaUtils.validateRowAgainstSchema] unquoted keyName', { k, keyName });
      match = columns.some(c => {
        if (!c.quoted) {
          const colLower = c.name.toLowerCase();
          log.debug('[schemaUtils.validateRowAgainstSchema] compare', { keyName, colLower, eq: colLower === keyName, c });
          return colLower === keyName;
        }
        return false;
      });
      log.debug('[schemaUtils.validateRowAgainstSchema] unquoted key match', { key: k, keyName, match, columns });
    }
    log.debug('[schemaUtils.validateRowAgainstSchema] key result', { k, isQuoted, match });
    return !match;
  });
  if (extra.length > 0) {
    log.debug('[schemaUtils.validateRowAgainstSchema] extra columns', { extra, columns, row });
    throw d1Error('EXTRA_COLUMNS', extra.join(', '));
  }
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('[schemaUtils.validateRowAgainstSchema] validated OK', { columns, row });
  }
  return { result: true };
}

/**
 * Normalizes a row to match the schema (D1-compatible).
 * Fills missing columns with null.
 * @param columns - The schema columns array.
 * @param row - The row to normalize.
 * @returns Normalized row.
 */
export function normalizeRowToSchema(columns: { original: string; name: string; quoted: boolean }[], row: Record<string, unknown>): Record<string, unknown> {
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('[schemaUtils.normalizeRowToSchema] called', { columns, row });
  }
  const normalized: Record<string, unknown> = {};
  for (const col of columns) {
    let value: unknown = null;
    if (col.quoted) {
      // Look for quoted key
      const quotedKey = '"' + col.name + '"';
      if (Object.prototype.hasOwnProperty.call(row, quotedKey)) {
        value = row[quotedKey];
        log.debug('[schemaUtils.normalizeRowToSchema] found quoted key', { quotedKey, value });
      } else if (Object.prototype.hasOwnProperty.call(row, col.name)) {
        value = row[col.name];
        log.debug('[schemaUtils.normalizeRowToSchema] found unquoted key for quoted col', { key: col.name, value });
      }
    } else {
      // Look for unquoted key (case-insensitive)
      const matchKey = Object.keys(row).find(k => k.toLowerCase() === col.name.toLowerCase());
      if (matchKey) {
        value = row[matchKey];
        log.debug('[schemaUtils.normalizeRowToSchema] found unquoted key', { matchKey, value });
      }
    }
    normalized[col.name] = value;
  }
  if (process.env.DEBUG || process.env.MOCK_D1_DEBUG) {
    log.debug('[schemaUtils.normalizeRowToSchema] normalized', { normalized });
  }
  return normalized;
}
