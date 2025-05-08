/**
 * @file helpers/mockD1Helpers.ts
 * @description Utility functions for mockD1Database.
 */

/**
 * Checks if the provided SQL string is supported by the mockD1Database engine.
 *
 * @param sql - The SQL statement string to check.
 * @returns True if the SQL is supported, false otherwise.
 */
export function isSupportedSQL(sql: string): boolean {
  const unsupported = [
    /\blike\b/i,
    /\bbetween\b/i,
    /\bjoin\b/i,
    /\bselect\s+.+\s+from.+\(.+\)/i,
  ];
  // Only allow valid patterns for supported statements
  const valid =
    /^create table(?: if not exists)? [a-zA-Z0-9_]+/i.test(sql) ||
    /^insert into [a-zA-Z0-9_]+/i.test(sql) ||
    /^select \* from [a-zA-Z0-9_]+/i.test(sql) ||
    /^delete from [a-zA-Z0-9_]+/i.test(sql) ||
    /^update [a-zA-Z0-9_]+ set /i.test(sql);

  return valid && !unsupported.some((regex) => regex.test(sql));
}

// Add more helpers as needed...