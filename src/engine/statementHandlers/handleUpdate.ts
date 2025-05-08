import { D1Row } from "../../types/MockD1Database";

/**
 * Handles UPDATE <table> SET <col> = :val WHERE <col2> = :val2 statements for the mock D1 engine.
 * Updates rows in the specified table that match the WHERE clause, setting the given column to the provided value.
 *
 * @param sql - The SQL UPDATE statement string.
 * @param db - The in-memory database map.
 * @param bindArgs - The named bind arguments for the statement.
 * @returns An object representing the result of the UPDATE operation.
 * @throws If the SQL statement is malformed, required bind arguments are missing, or the table does not exist.
 */
export function handleUpdate(
  sql: string,
  db: Map<string, { rows: D1Row[] }>,
  bindArgs: Record<string, unknown>
) {
  const tableMatch = sql.match(/^update ([a-zA-Z0-9_]+) set /i);
  if (!tableMatch) throw new Error("Malformed UPDATE statement.");
  const table = tableMatch[1];
  const setMatch = sql.match(/set ([a-zA-Z0-9_]+)\s*=\s*:(\w+)/i);
  const whereMatch = sql.match(/where ([a-zA-Z0-9_]+)\s*=\s*:(\w+)/i);
  if (!setMatch || !whereMatch) throw new Error("Only simple UPDATE ... SET col = :val WHERE col2 = :val2 supported.");
  const [, setCol, setBind] = setMatch;
  const [, whereCol, whereBind] = whereMatch;
  if (!(setBind in bindArgs)) throw new Error(`Missing bind argument: ${setBind}`);
  if (!(whereBind in bindArgs)) throw new Error(`Missing bind argument: ${whereBind}`);
  const tableObj = db.get(table);
  if (!tableObj) throw new Error(`Table not found: ${table}`);
  let changes = 0;
  for (const row of tableObj.rows) {
    if (row[whereCol] === bindArgs[whereBind]) {
      row[setCol] = bindArgs[setBind];
      changes++;
    }
  }
  return {
    success: true,
    results: [],
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: changes,
      rows_written: changes,
      last_row_id: 0,
      changed_db: changes > 0,
      changes,
    },
  };
}