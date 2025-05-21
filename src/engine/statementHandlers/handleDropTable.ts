import { D1Row } from "../../types/MockD1Database";
import { findTableKey } from "../helpers.js";

/**
 * Handles DROP TABLE <table> statements.
 */
export function handleDropTable(
  sql: string,
  db: Map<string, { rows: D1Row[] }>
) {
  const tableMatch = sql.match(/drop table (\S+)/i);
  if (!tableMatch) throw new Error("Malformed DROP TABLE statement.");
  const table = tableMatch[1];
  // Case-insensitive table lookup using helper
  const tableKey = findTableKey(db, table);
  if (!tableKey) throw new Error(`Table '${table}' does not exist in the database.`);
  db.delete(tableKey);
  return {
    success: true,
    results: [],
    meta: {
      duration: 0, size_after: 0, rows_read: 0, rows_written: 0,
      last_row_id: 0, changed_db: true, changes: 0,
    },
  };
}