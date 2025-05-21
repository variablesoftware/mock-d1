import { D1Row } from "../../types/MockD1Database";
import { matchesWhere } from "../whereMatcher.js";
import { findTableKey, filterSchemaRow } from "../helpers.js";
import { log } from "@variablesoftware/logface";

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
  const isDebug = process.env.DEBUG === '1';
  if (isDebug) log.debug("called", { sql, bindArgs });
  // Support quoted identifiers and normalize table name to lower-case
  // Matches: DELETE FROM <table> [WHERE ...], where <table> can be quoted, unquoted, or a SQL keyword
  const tableMatch = sql.match(/delete from\s+([`"\[])(.+?)\1|delete from\s+([\w$]+)/i);
  if (!tableMatch) throw new Error("Malformed DELETE statement.");
  // Extract table name, strip quotes if present, and normalize to lower-case
  const table = (tableMatch[2] || tableMatch[3]).toLowerCase();
  if (isDebug) log.debug("normalized table name", { raw: tableMatch[1] ? tableMatch[1] + (tableMatch[2] || '') + tableMatch[1] : tableMatch[3], table });
  // Case-insensitive table lookup using helper
  const tableKey = findTableKey(db, table);
  // Only log at debug for before/after state and info for summary
  if (isDebug) log.debug("tableKey resolved", { table, tableKey });
  if (!tableKey) throw new Error(`Table '${table}' does not exist in the database.`);
  const rows = db.get(tableKey)?.rows ?? [];
  if (isDebug) log.debug("rows before", { rows });
  const dataRows = filterSchemaRow(rows);
  let toDelete: D1Row[] = [];
  const whereMatch = sql.match(/where (.+)$/i);
  if (whereMatch) {
    const cond = whereMatch[1];
    const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    for (const name of bindNames) {
      if (!(name in bindArgs)) throw new Error(`Missing bind argument: ${name}`);
    }
    toDelete = dataRows.filter(row => {
      const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      return matchesWhere(normRow, cond, bindArgs);
    });
  } else {
    toDelete = dataRows;
  }
  const schemaRow = rows.length > 0 ? rows[0] : undefined;
  const remainingDataRows = dataRows.filter(r => !toDelete.includes(r));
  let newRows: D1Row[];
  if (remainingDataRows.length === 0) {
    newRows = [];
    if (isDebug) log.debug("all data rows deleted, table will be empty");
  } else {
    if (schemaRow && Object.values(schemaRow).some(v => v !== undefined)) {
      newRows = [schemaRow, ...remainingDataRows];
    } else {
      newRows = [...remainingDataRows];
    }
  }
  db.set(tableKey, { rows: newRows });
  if (isDebug) log.debug("final table rows", { tableKey, newRows });
  log.info("deleted rows", { changes: toDelete.length, size_after: filterSchemaRow(newRows).length });
  return {
    success: true,
    results: [],
    changes: toDelete.length,
    meta: {
      duration: 0,
      size_after: filterSchemaRow(newRows).length,
      rows_read: 0, // always 0 for DELETE per test expectation
      rows_written: 0, // always 0 for DELETE per test expectation
      last_row_id: 0,
      changed_db: toDelete.length > 0,
      changes: toDelete.length,
    },
  };
}