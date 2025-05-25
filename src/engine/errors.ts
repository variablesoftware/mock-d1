/**
 * @file engine/errors.ts
 * @description Centralized error messages and error creation for mockD1Database.
 * @warning These are mock/test-only and strive to match Cloudflare D1 error output where possible.
 */

/**
 * D1-like error messages for uniformity and easier test assertions.
 */
export const D1_ERRORS = {
  MALFORMED_INSERT: 'Malformed INSERT statement',
  MALFORMED_SELECT: 'Malformed SELECT statement',
  MALFORMED_DELETE: 'Malformed DELETE statement',
  MALFORMED_UPDATE: 'Malformed UPDATE statement',
  MALFORMED_CREATE: 'Malformed CREATE TABLE statement',
  MALFORMED_DROP: 'Malformed DROP TABLE statement',
  MALFORMED_TRUNCATE: 'Malformed TRUNCATE TABLE statement',
  MALFORMED_ALTER: 'Malformed ALTER TABLE statement',
  UNSUPPORTED_SQL: 'Unsupported SQL syntax',
  UNSUPPORTED_TYPE: 'Unsupported data type',
  MISSING_BIND: 'Missing bind argument', // Alias for compatibility
  MISSING_BIND_ARGUMENT: 'Missing bind argument',
  MISSING_BIND_PARAMETER: 'Missing bind argument',
  EXTRA_COLUMNS: 'Attempted to insert with columns not present in schema',
  EMPTY_SCHEMA: 'Cannot inject: schema row is empty',
  MULTI_STATEMENT: 'Multiple SQL statements in one string are not allowed',
  TABLE_NOT_FOUND: 'Table does not exist',
  COLUMN_NOT_FOUND: 'Column does not exist',
  INVALID_ARGUMENT: 'Invalid argument',
  SQL_INJECTION_ATTEMPT: 'Potential SQL injection detected',
  GENERIC: 'D1 error',
};

/**
 * Creates a new Error with a D1-like message.
 * @param code - The error code from D1_ERRORS.
 * @param details - Optional details to append to the message.
 * @returns Error instance.
 */
export function d1Error(code: keyof typeof D1_ERRORS, details?: string): Error {
  if (!(code in D1_ERRORS)) {
    throw new Error(`Unknown D1 error code: ${String(code)}`);
  }
  const msg = details ? `${D1_ERRORS[code]}: ${details}` : D1_ERRORS[code];
  return new Error(msg);
}
