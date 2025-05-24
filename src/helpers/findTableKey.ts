/**
 * Finds the actual table key in the db Map for a given table name, case-insensitively.
 * @param db - The database Map
 * @param table - The table name to look up
 * @returns The actual key in the db Map, or undefined if not found
 */
export function findTableKey(db: Map<string, unknown>, table: string): string | undefined {
  return Array.from(db.keys()).find(k => k.toLowerCase() === table.toLowerCase());
}
