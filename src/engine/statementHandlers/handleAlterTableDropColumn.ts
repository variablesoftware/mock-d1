/**
 * @file engine/statementHandlers/handleAlterTableDropColumn.ts
 * @description Handler for ALTER TABLE ... DROP COLUMN ... (not supported by Cloudflare D1).
 * @warning This is a mock/test-only concern. D1 does not support dropping columns as of 2025-05-22.
 */
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';

/**
 * Throws a D1-like error for unsupported ALTER TABLE ... DROP COLUMN ... statements.
 * @throws Always throws UNSUPPORTED_SQL error.
 */
export function handleAlterTableDropColumn(
  sql?: string,
  db?: Map<string, { rows: unknown[] }>
) {
  if (sql) validateSqlOrThrow(sql);
  throw d1Error('UNSUPPORTED_SQL', 'ALTER TABLE ... DROP COLUMN is not supported by Cloudflare D1');
}
