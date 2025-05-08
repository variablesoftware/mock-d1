import { D1Row } from "../../types/MockD1Database";

/**
 * Handles INSERT INTO <table> (...) VALUES (...) statements for the mock D1 engine.
 * Inserts a new row into the specified table using the provided bind arguments.
 *
 * @param sql - The SQL INSERT statement string.
 * @param db - The in-memory database map.
 * @param bindArgs - The named bind arguments for the statement.
 * @returns An object representing the result of the INSERT operation.
 * @throws If the SQL statement is malformed or the column/bind count does not match.
 */
export function handleInsert(
  sql: string,
  db: Map<string, { rows: D1Row[] }>,
  bindArgs: Record<string, unknown>
) {
  const tableMatch = sql.match(/insert into ([a-zA-Z0-9_]+)/i);
  const colMatch = sql.match(/\(([^)]+)\)/);
  if (tableMatch && colMatch) {
    const table = tableMatch[1];
    const columns = colMatch[1].split(",").map(s => s.trim());
    if (columns.length !== Object.keys(bindArgs).length) {
      throw new Error("INSERT column/bind count mismatch");
    }
    const row: Record<string, unknown> = {};
    for (const col of columns) row[col] = bindArgs[col];
    if (!db.has(table)) db.set(table, { rows: [] });
    db.get(table)!.rows.push(row);
    return {
      success: true,
      results: [],
      meta: {
        duration: 0, size_after: 0, rows_read: 0, rows_written: 1,
        last_row_id: 0, changed_db: true, changes: 1,
      },
    };
  }
  throw new Error("Malformed INSERT statement.");
}