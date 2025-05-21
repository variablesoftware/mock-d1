/**
 * Validates if the given SQL command is supported.
 * @param sql - The SQL statement string.
 * @returns True if the SQL command is supported, false otherwise.
 */
export function validateSQLSyntax(sql: string): boolean {
  const supportedCommands = /^(CREATE|INSERT|SELECT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\s/i;
  return supportedCommands.test(sql.trim());
}
