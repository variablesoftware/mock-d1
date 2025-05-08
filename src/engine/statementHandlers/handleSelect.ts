import { D1Row } from "../../types/MockD1Database";

/**
 * Handles SELECT * FROM <table> [WHERE ...] statements for the mock D1 engine.
 * Retrieves rows from the specified table, optionally filtered by a WHERE clause.
 *
 * @param sql - The SQL SELECT statement string.
 * @param db - The in-memory database map.
 * @param bindArgs - The named bind arguments for the statement.
 * @param matchesWhere - A function to evaluate WHERE clause conditions.
 * @param mode - "all" to return all matching rows, "first" to return only the first.
 * @returns An object representing the result of the SELECT operation.
 * @throws If the SQL statement is malformed or required bind arguments are missing.
 */
export function handleSelect(
  sql: string,
  db: Map<string, { rows: D1Row[] }>,
  bindArgs: Record<string, unknown>,
  matchesWhere: (_row: D1Row, _cond: string) => boolean,
  mode: "all" | "first"
) {
  const tableMatch = sql.match(/from ([a-zA-Z0-9_]+)/i);
  if (!tableMatch) throw new Error("Malformed SELECT statement.");
  const table = tableMatch[1];
  const rows = db.get(table)?.rows ?? [];
  let filtered = rows;
  const whereMatch = sql.match(/where (.+)$/i);
  if (whereMatch) {
    const cond = whereMatch[1];
    // Check all binds exist
    const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    for (const name of bindNames) {
      if (!(name in bindArgs)) throw new Error(`Missing bind argument: ${name}`);
    }
    filtered = rows.filter((_row) => matchesWhere(_row, cond, bindArgs));
  }
  const results = mode === "first" ? filtered.slice(0, 1) : filtered;
  return {
    success: true,
    results,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: results.length,
      rows_written: 0,
      last_row_id: 0,
      changed_db: false,
      changes: 0,
    },
  };
}