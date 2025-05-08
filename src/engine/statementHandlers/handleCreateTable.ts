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
  const tableMatch = sql.match(/create table(?: if not exists)? ([a-zA-Z0-9_]+)/i);
  if (!tableMatch) throw new Error("Malformed CREATE TABLE statement.");
  const table = tableMatch[1];
  if (!db.has(table)) db.set(table, { rows: [] });
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