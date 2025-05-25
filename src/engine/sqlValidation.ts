import { log } from '@variablesoftware/logface';
import { d1Error, D1_ERRORS } from './errors.js';

const UNSUPPORTED_SQL_PATTERNS = [
  /\bIN\b/i,
  /\bNOT\s+IN\b/i,
  /\bBETWEEN\b/i,
  /\bLIKE\b/i,
  /\bGLOB\b/i,
  /\bREGEXP\b/i,
  /\bANY\b/i,
  /\bALL\b/i,
  /\bSOME\b/i,
  /\bEXISTS\b/i,
  /\bIS\s+DISTINCT\s+FROM\b/i,
  /\bESCAPE\b/i
];

/**
 * Checks if the given SQL command is supported by D1.
 *
 * Validation funnel:
 * 1. Trim the SQL statement.
 * 2. Explicitly allow CREATE TABLE (with or without IF NOT EXISTS, with or without columns).
 *    - This is handled first to avoid false positives from unsupported pattern checks (e.g., "IN" in "IF NOT EXISTS").
 * 3. For all other statements, check for unsupported SQL patterns (e.g., IN, LIKE, BETWEEN, etc.).
 *    - If any unsupported pattern is found, the statement is rejected.
 * 4. Allow other primary SQL operations (INSERT, SELECT, UPDATE, DELETE, DROP, TRUNCATE, ALTER) if they do not contain unsupported patterns.
 * 5. Reject everything else.
 *
 * @param sql - The SQL statement string.
 * @returns True if the SQL command is supported and does not contain unsupported features, false otherwise.
 */
export function validateSQLSyntax(sql: string): boolean {
  const trimmed = sql.trim();

  // 1. Explicitly allow CREATE TABLE (with or without IF NOT EXISTS)
  //    This must be first to avoid false positives from unsupported pattern checks.
  if (
    /^CREATE\s+TABLE(\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][\w$]*|"[^"]+")(\s*\(.*\))?\s*;?$/i.test(trimmed)
  ) {
    return true;
  }

  // 2. For all other statements, check for unsupported patterns
  for (const pattern of UNSUPPORTED_SQL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  // 3. Allow other primary operations
  if (/^(INSERT|SELECT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/i.test(trimmed)) {
    return true;
  }

  // 4. Reject everything else
  return false;
}

/**
 * Centralized SQL validation for D1 mock engine.
 * Throws a D1-like error if the SQL is not a supported command or contains unsupported features/operators.
 * Optionally skips malformed SQL checks (for prepare-time validation only).
 * @param sql - The SQL statement string.
 * @param opts - Optional options object.
 */
export function validateSqlOrThrow(sql: string, opts?: { skipMalformed?: boolean }): void {
  const trimmed = sql.trim();
  // Special case: malformed CREATE (e.g., 'CREATE foo') should throw MALFORMED_CREATE, not UNSUPPORTED_SQL
  if (/^CREATE\b/i.test(trimmed) && !/^CREATE\s+TABLE\b/i.test(trimmed)) {
    throw d1Error('MALFORMED_CREATE', 'MALFORMED_CREATE');
  }
  if (!validateSQLSyntax(sql)) {
    log.error('SQL validation failed: Unsupported SQL command or feature.', { sql });
    throw d1Error('UNSUPPORTED_SQL', 'UNSUPPORTED_SQL');
  }
  if (!opts?.skipMalformed) {
    // Malformed SQL checks (very basic, only for top-level statement type)
    if (/^SELECT\b/i.test(trimmed) && !/FROM\b/i.test(trimmed)) {
      throw d1Error('MALFORMED_SELECT', 'MALFORMED_SELECT');
    }
    if (/^INSERT\b/i.test(trimmed) && !/VALUES\b/i.test(trimmed)) {
      throw d1Error('MALFORMED_INSERT', 'MALFORMED_INSERT');
    }
    if (/^DELETE\b/i.test(trimmed) && !/FROM\b/i.test(trimmed)) {
      throw d1Error('MALFORMED_DELETE', 'MALFORMED_DELETE');
    }
    if (/^UPDATE\b/i.test(trimmed) && !/SET\b/i.test(trimmed)) {
      throw d1Error('MALFORMED_UPDATE', 'MALFORMED_UPDATE');
    }
    if (/^CREATE\b/i.test(trimmed) && !/TABLE\b/i.test(trimmed)) {
      throw d1Error('MALFORMED_CREATE', 'MALFORMED_CREATE');
    }
    if (/^DROP\b/i.test(trimmed) && !/TABLE\b/i.test(trimmed)) {
      throw d1Error('MALFORMED_DROP', 'MALFORMED_DROP');
    }
    if (/^TRUNCATE\b/i.test(trimmed) && !/TABLE\b/i.test(trimmed)) {
      throw d1Error('MALFORMED_TRUNCATE', 'MALFORMED_TRUNCATE');
    }
    if (/^ALTER\b/i.test(trimmed) && !/TABLE\b/i.test(trimmed)) {
      throw d1Error('MALFORMED_ALTER', 'MALFORMED_ALTER');
    }
  }
}
