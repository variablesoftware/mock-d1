import { d1Error } from './errors.js';

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
 * @param sql - The SQL statement string.
 * @returns True if the SQL command is supported, false otherwise.
 */
function validateSQLSyntax(sql: string): boolean {
  const supportedCommands = /^(CREATE|INSERT|SELECT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\s/i;
  return supportedCommands.test(sql.trim());
}

/**
 * Centralized SQL validation for D1 mock engine.
 * Throws a D1-like error if the SQL is not a supported command or contains unsupported features/operators.
 * @param sql - The SQL statement string.
 */
export function validateSqlOrThrow(sql: string): void {
  if (!validateSQLSyntax(sql)) {
    throw d1Error('UNSUPPORTED_SQL', 'This SQL command is not supported by D1.');
  }
  for (const pattern of UNSUPPORTED_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      throw d1Error('UNSUPPORTED_SQL', 'This SQL feature/operator is not supported by D1.');
    }
  }
}
