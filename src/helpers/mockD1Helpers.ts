/**
 * @file helpers/mockD1Helpers.ts
 * @description Utility functions for mockD1Database.
 */

export function isSupportedSQL(sql: string): boolean {
  const unsupported = [
    /\blike\b/i,
    /\bbetween\b/i,
    /\bjoin\b/i,
    /\bselect\s+.+\s+from.+\(.+\)/i,
  ];
  return !unsupported.some((regex) => regex.test(sql));
}

// Add more helpers as needed...