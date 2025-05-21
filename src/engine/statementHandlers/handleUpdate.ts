import { D1Row } from "../../types/MockD1Database";
import { findTableKey, filterSchemaRow } from "../helpers.js";
import { log } from "@variablesoftware/logface";
import { matchesWhere } from "../whereMatcher.js";

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
  const isDebug = process.env.DEBUG === '1';
  if (isDebug) log.debug("handleUpdate called", { sql, bindArgs });
  // Support quoted identifiers and normalize table/column names
  // Matches: UPDATE <table> SET <col> = :val [WHERE <col2> = :val2], where <table> can be quoted or unquoted, and SQL keywords allowed
  const tableMatch = sql.match(/^update\s+([`"[])(.+?)\1\s+set\s+|^update\s+([\w$]+)\s+set\s+/i);
  if (!tableMatch) throw new Error("Malformed UPDATE statement.");
  const table = (tableMatch[2] || tableMatch[3]).toLowerCase();
  if (isDebug) log.debug("handleUpdate normalized table name", { raw: tableMatch[1] ? tableMatch[1] + (tableMatch[2] || '') + tableMatch[1] : tableMatch[3], table });
  // Case-insensitive table lookup using helper
  const tableKey = findTableKey(db, table);
  if (isDebug) log.debug("handleUpdate tableKey", { table, tableKey });
  if (!tableKey) throw new Error(`Table '${table}' does not exist in the database.`);
  // Normalize set/where columns to lower-case, support quoted identifiers and SQL keywords
  const setMatch = sql.match(/set\s+([`"[])(.+?)\1\s*=\s*:(\w+)|set\s+([\w$]+)\s*=\s*:(\w+)/i);
  const whereMatch = sql.match(/where\s+([`"[])(.+?)\1\s*=\s*:(\w+)|where\s+([\w$]+)\s*=\s*:(\w+)/i);

  if (!setMatch) throw new Error("Malformed UPDATE statement.");
  const setCol: string = (setMatch[2] || setMatch[4]).toLowerCase();
  const setBind: string = setMatch[3] || setMatch[5];
  if (isDebug) log.debug("handleUpdate setCol/setBind (normalized)", { setCol, setBind });
  let whereCol: string | undefined, whereBind: string | undefined;
  if (whereMatch) {
    whereCol = (whereMatch[2] || whereMatch[4]).toLowerCase();
    whereBind = whereMatch[3] || whereMatch[5];
    if (isDebug) log.debug("handleUpdate whereCol/whereBind (normalized)", { whereCol, whereBind });
  }

  const tableObj = db.get(tableKey);
  let changes = 0;
  let rowsRead = 0;
  // Skip schema row for updates: only update data rows, never the schema row
  const dataRows = tableObj ? filterSchemaRow(tableObj.rows) : [];
  if (isDebug) log.debug("handleUpdate dataRows (schema row skipped)", { dataRows });

  if (whereMatch && whereCol && whereBind) {
    // Accept bind arg names case-insensitively
    const bindKeys = Object.keys(bindArgs);
    const setBindKey = bindKeys.find(k => k.toLowerCase() === setBind.toLowerCase());
    const whereBindKey = bindKeys.find(k => k.toLowerCase() === whereBind!.toLowerCase());
    if (!whereBindKey) throw new Error(`Missing bind argument: ${whereBind}`);
    // Use canonical columns from schema row for column matching, normalized
    const canonicalCols = tableObj && tableObj.rows[0] ? Object.keys(tableObj.rows[0]).map(k => k.toLowerCase()) : [];
    // Normalize row keys to lower-case for WHERE matching
    if (isDebug) {
      const matchResults = dataRows.map((row, i) => {
        const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
        return { i, row, normRow, matches: matchesWhere(normRow, `${whereCol} = :${whereBind}`, bindArgs) };
      });
      log.debug("handleUpdate matchesWhere results", matchResults);
    }
    for (const row of dataRows) {
      const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      const rowKeys = Object.keys(row).map(k => k.toLowerCase());
      const whereRowKey = canonicalCols.find(k => k === whereCol) || rowKeys.find(k => k === whereCol);
      let setRowKey = canonicalCols.find(k => k === setCol) || rowKeys.find(k => k === setCol);
      if (whereRowKey && setRowKey && matchesWhere(normRow, `${whereCol} = :${whereBind}`, bindArgs)) {
        if (setBindKey && row[setRowKey] !== bindArgs[setBindKey]) {
          // Stringify JSON-serializable objects/arrays
          let value = bindArgs[setBindKey];
          if (typeof value === 'object' && value !== null) {
            try {
              value = JSON.stringify(value);
            } catch {
              throw new Error("Unsupported data type");
            }
          }
          row[setRowKey] = value;
          changes++;
        }
        rowsRead++;
      }
    }
  } else {
    // No WHERE: update all data rows
    const bindKeys = Object.keys(bindArgs);
    const setBindKey = bindKeys.find(k => k.toLowerCase() === setBind.toLowerCase());
    // --- Ensure the column exists in the schema row ---
    if (tableObj && tableObj.rows.length > 0) {
      const schemaRow = tableObj.rows[0];
      const schemaCols = Object.keys(schemaRow).map(k => k.toLowerCase());
      if (!schemaCols.includes(setCol)) {
        // Add the new column to the schema row
        schemaRow[setCol] = undefined;
      }
    }
    // --- Ensure the column exists in all data rows before updating ---
    for (const row of dataRows) {
      const rowKeys = Object.keys(row).map(k => k.toLowerCase());
      if (!rowKeys.includes(setCol)) {
        row[setCol] = undefined;
      }
    }
    // --- Now update all data rows ---
    for (const [i, row] of dataRows.entries()) {
      // Normalize row keys for case-insensitive matching
      const rowKeyMap = Object.fromEntries(Object.keys(row).map(k => [k.toLowerCase(), k]));
      let setRowKey = rowKeyMap[setCol] || setCol;
      // Always set the value for all data rows (not just if oldValue !== newValue)
      if (setBindKey) {
        let value = bindArgs[setBindKey];
        if (typeof value === 'object' && value !== null) {
          try {
            value = JSON.stringify(value);
          } catch {
            throw new Error("Unsupported data type");
          }
        }
        row[setRowKey] = value;
        changes++;
        if (isDebug) log.debug("handleUpdate updated row", { rowIndex: i, setRowKey, newValue: value });
      } else {
        if (isDebug) log.debug("handleUpdate skipped row (no bind value)", { rowIndex: i, setRowKey });
      }
      rowsRead++;
    }
  }

  if (isDebug) log.debug("handleUpdate final table rows (normalized)", { tableKey, tableObj: tableObj?.rows });
  log.info("handleUpdate: update complete", { tableKey, changes });
  return {
    success: true,
    results: [],
    meta: {
      duration: 0,
      size_after: tableObj ? filterSchemaRow(tableObj.rows).length : 0,
      rows_read: rowsRead,
      rows_written: changes,
      last_row_id: tableObj ? tableObj.rows.length : 0,
      changed_db: changes > 0,
      changes,
    },
  };
}