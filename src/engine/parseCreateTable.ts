// src/engine/parseCreateTable.ts

/**
 * Parses a CREATE TABLE statement and validates columns.
 * Throws if malformed or columns are missing/invalid.
 * @param sql - The CREATE TABLE SQL statement.
 * @returns An object with tableName and columns array.
 */
export function parseCreateTable(sql: string): { tableName: string; columns: string[] } {
  const match = sql.match(/^CREATE\s+TABLE\s+([^\s(]+)\s*\((.*)\)$/i);
  if (!match) {
    throw new Error("Malformed CREATE TABLE statement");
  }
  const [, tableName, columnsRaw] = match;
  if (columnsRaw.trim() === "") {
    throw new Error("Syntax error: CREATE TABLE must define at least one column");
  }
  const columns = columnsRaw.split(",").map(col => col.trim());
  if (
    columns.length === 0 ||
    columns.some(col => col === "") ||
    /^\s*,|,\s*$/.test(columnsRaw) ||
    /,,/.test(columnsRaw)
  ) {
    throw new Error("Syntax error: CREATE TABLE must define at least one column");
  }
  return { tableName, columns };
}
