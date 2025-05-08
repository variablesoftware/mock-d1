import { D1Row } from "../../types/MockD1Database";

/**
 * Handles TRUNCATE TABLE <table> statements.
 */
export function handleTruncateTable(
  sql: string,
  db: Map<string, { rows: D1Row[] }>
) {
  const tableMatch = sql.match(/truncate table ([a-zA-Z0-9_]+)/i);
  if (!tableMatch) throw new Error("Malformed TRUNCATE TABLE statement.");
  const table = tableMatch[1];
  if (db.has(table)) db.set(table, { rows: [] });
  return {
    success: true,
    results: [],
    meta: {
      duration: 0, size_after: 0, rows_read: 0, rows_written: 0,
      last_row_id: 0, changed_db: true, changes: 0,
    },
  };
}