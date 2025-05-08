import { D1Row } from "../../types/MockD1Database";

/**
 * Handles ALTER TABLE <table> ADD COLUMN <col> statements (stub).
 */
export function handleAlterTableAddColumn(
  sql: string,
  db: Map<string, { rows: D1Row[] }>
) {
  const match = sql.match(/alter table ([a-zA-Z0-9_]+) add column ([a-zA-Z0-9_]+)/i);
  if (!match) throw new Error("Malformed ALTER TABLE ADD COLUMN statement.");
  const table = match[1];
  const col = match[2];
  const tableObj = db.get(table);
  if (tableObj) {
    for (const row of tableObj.rows) {
      if (!(col in row)) row[col] = undefined;
    }
  }
  return {
    success: true,
    results: [],
    meta: {
      duration: 0, size_after: 0, rows_read: 0, rows_written: 0,
      last_row_id: 0, changed_db: true, changes: 0,
    },
  };
}