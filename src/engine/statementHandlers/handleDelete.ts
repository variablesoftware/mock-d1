import { D1Row } from "../../types/MockD1Database";
import { matchesWhere } from "../whereMatcher";

/**
 * Handles DELETE FROM <table> [WHERE ...] statements for the mock D1 engine.
 * Deletes rows from the specified table, optionally filtered by a WHERE clause.
 *
 * @param sql - The SQL DELETE statement string.
 * @param db - The in-memory database map.
 * @param bindArgs - The named bind arguments for the statement.
 * @returns An object representing the result of the DELETE operation.
 * @throws If the SQL statement is malformed or required bind arguments are missing.
 */
export function handleDelete(
  sql: string,
  db: Map<string, { rows: D1Row[] }>,
  bindArgs: Record<string, unknown>
) {
  const tableMatch = sql.match(/delete from ([a-zA-Z0-9_]+)/i);
  if (!tableMatch) throw new Error("Malformed DELETE statement.");
  const table = tableMatch[1];
  const rows = db.get(table)?.rows ?? [];
  let toDelete: D1Row[] = [];
  const whereMatch = sql.match(/where (.+)$/i);
  if (whereMatch) {
    const cond = whereMatch[1];
    const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    for (const name of bindNames) {
      if (!(name in bindArgs)) throw new Error(`Missing bind argument: ${name}`);
    }
    toDelete = rows.filter(row => matchesWhere(row, cond, bindArgs));
  } else {
    toDelete = rows;
  }
  db.set(table, { rows: rows.filter(r => !toDelete.includes(r)) });
  return {
    success: true,
    results: [],
    changes: toDelete.length,
    meta: {
      duration: 0, size_after: 0, rows_read: 0, rows_written: 0,
      last_row_id: 0, changed_db: true, changes: toDelete.length,
    },
  };
}