import { D1Row } from "../../types/MockD1Database";

/**
 * Handles CREATE TABLE [IF NOT EXISTS] <table> statements for the mock D1 engine.
 * Adds the table to the in-memory database if it does not already exist.
 *
 * @param sql - The SQL statement string.
 * @param db - The in-memory database map.
 * @returns An object representing the result of the CREATE TABLE operation.
 * @throws If the SQL statement is malformed.
 */
export function handleCreateTable(
  sql: string,
  db: Map<string, { rows: D1Row[] }>
) {
  const tableMatch = sql.match(/create table(?: if not exists)? (\S+)/i);
  if (!tableMatch) throw new Error("Malformed CREATE TABLE statement.");
  const table = tableMatch[1];
  // Parse columns from CREATE TABLE statement
  const colMatch = sql.match(/\(([^)]+)\)/);
  let columns: string[] = [];
  if (colMatch) {
    // Only use the column name (first word) for canonical columns
    columns = colMatch[1].split(",").map(s => s.trim().split(/\s+/)[0]);
    if (columns.length === 0 || columns.some(c => !c)) {
      throw new Error("Malformed CREATE TABLE statement: must define at least one column");
    }
  }
  // Only add the table if a case-insensitive match does not already exist
  const tableKey = Array.from(db.keys()).find(k => k.toLowerCase() === table.toLowerCase());
  if (!tableKey) {
    // Always create a schema row (even for no columns)
    const row: Record<string, unknown> = {};
    for (const col of columns) row[col] = undefined;
    db.set(table, { rows: [row] });
  }
  return {
    success: true,
    results: [],
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: 0,
      last_row_id: 0,
      changed_db: true,
      changes: 0,
    },
  };
}