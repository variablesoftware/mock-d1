/**
 * @file engine/tableUtils/tableLookup.ts
 * @description Utilities for D1-like table and column lookup (case-insensitive, D1-compatible).
 */

/**
 * Finds the canonical table key in the database Map, case-insensitively (D1-compatible).
 * @param db - The database Map.
 * @param tableName - The table name to look up.
 * @returns The canonical table key if found, or undefined.
 */
export function findTableKey(db: Map<string, unknown>, tableName: string): string | undefined {
  const lower = tableName.toLowerCase();
  for (const key of db.keys()) {
    if (key.toLowerCase() === lower) return key;
  }
  return undefined;
}

/**
 * Finds the canonical column key in a schema row, case-insensitively (D1-compatible).
 * @param schemaRow - The schema row (object with column names as keys).
 * @param columnName - The column name to look up.
 * @returns The canonical column key if found, or undefined.
 */
export function findColumnKey(schemaRow: Record<string, unknown>, columnName: string): string | undefined {
  const lower = columnName.toLowerCase();
  for (const key of Object.keys(schemaRow)) {
    if (key.toLowerCase() === lower) return key;
  }
  return undefined;
}
