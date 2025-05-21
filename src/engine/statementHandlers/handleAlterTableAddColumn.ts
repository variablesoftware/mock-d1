import { D1Row } from "../../types/MockD1Database";
import { findTableKey, filterSchemaRow } from "../helpers.js";

/**
 * Handles ALTER TABLE <table> ADD COLUMN <col> statements (stub).
 */
export function handleAlterTableAddColumn(
  sql: string,
  db: Map<string, { rows: D1Row[] }>
) {
  const match = sql.match(/alter table (\S+) add column (\S+)(?:\s+(\w+))?/i);
  if (!match) throw new Error("Malformed ALTER TABLE ADD COLUMN statement.");
  const table = match[1];
  const col = match[2];
  const type = match[3];
  // Case-insensitive table lookup using helper
  const tableKey = findTableKey(db, table);
  if (!tableKey) throw new Error(`Table '${table}' does not exist in the database.`);
  if (type && !/^(INTEGER|TEXT|REAL|BLOB)$/i.test(type)) {
    throw new Error(`Unsupported column type: ${type}`);
  }
  const tableObj = db.get(tableKey);
  if (tableObj) {
    // Add column to schema row if present
    if (tableObj.rows.length && Object.values(tableObj.rows[0]).every(v => typeof v === 'undefined')) {
      if (!(Object.keys(tableObj.rows[0]).some(k => k.toLowerCase() === col.toLowerCase()))) {
        tableObj.rows[0][col] = undefined;
      }
    }
    // Add column to all data rows
    for (const row of filterSchemaRow(tableObj.rows)) {
      if (!(Object.keys(row).some(k => k.toLowerCase() === col.toLowerCase()))) {
        row[col] = undefined;
      }
    }
  }
  return {
    success: true,
    results: [],
    meta: {
      duration: 0, size_after: tableObj ? filterSchemaRow(tableObj.rows).length : 0, rows_read: 0, rows_written: 0,
      last_row_id: 0, changed_db: true, changes: 0,
    },
  };
}