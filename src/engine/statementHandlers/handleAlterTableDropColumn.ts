/**
 * @file engine/statementHandlers/handleAlterTableDropColumn.ts
 * @description Handler for ALTER TABLE ... DROP COLUMN ... (not supported by Cloudflare D1).
 * @warning This is a mock/test-only concern. D1 does not support dropping columns as of 2025-05-22.
 */
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';
import { log } from "@variablesoftware/logface";

/**
 * Throws a D1-like error for unsupported ALTER TABLE ... DROP COLUMN ... statements.
 * @throws Always throws UNSUPPORTED_SQL error.
 */
export function handleAlterTableDropColumn(
  sql?: string,
  _db?: Map<string, { rows: unknown[] }>
) {
  log.debug("handleAlterTableDropColumn called", { sql });
  if (sql) validateSqlOrThrow(sql);
  log.error("ALTER TABLE DROP COLUMN is not supported", { sql });
  throw d1Error('UNSUPPORTED_SQL', 'ALTER TABLE ... DROP COLUMN is not supported by Cloudflare D1');
}
