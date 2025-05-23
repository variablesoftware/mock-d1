import { D1Row } from "../../types/MockD1Database";
import { filterSchemaRow } from "../helpers.js";
import { log } from "@variablesoftware/logface";
import { evaluateWhereClause } from '../where/evaluateWhereClause.js';
import { extractTableName } from '../tableUtils/tableNameUtils.js';
import { findTableKey, findColumnKey } from '../tableUtils/tableLookup.js';
import { validateRowAgainstSchema, normalizeRowToSchema } from '../tableUtils/schemaUtils.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';

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
  validateSqlOrThrow(sql);
  log.debug("handleUpdate called", { sql, bindArgs });
  // Use shared utility for table name extraction and lookup
  const tableName = extractTableName(sql, 'UPDATE');
  const tableKey = findTableKey(db, tableName);
  log.debug("handleUpdate tableKey", { tableName, tableKey });
  if (!tableKey) throw d1Error('TABLE_NOT_FOUND', tableName);
  // Normalize set/where columns to lower-case, support quoted identifiers and SQL keywords
  const setMatch = sql.match(/set\s+([`"[])(.+?)\1\s*=\s*:(\w+)|set\s+([\w$]+)\s*=\s*:(\w+)/i);
  const whereMatch = sql.match(/where\s+([`"[])(.+?)\1\s*=\s*:(\w+)|where\s+([\w$]+)\s*=\s*:(\w+)/i);

  if (!setMatch) throw new Error("Malformed UPDATE statement.");
  const setCol: string = (setMatch[2] || setMatch[4]).toLowerCase();
  const setBind: string = setMatch[3] || setMatch[5];
  log.debug("handleUpdate setCol/setBind (normalized)", { setCol, setBind });
  let whereCol: string | undefined, whereBind: string | undefined;
  if (whereMatch) {
    whereCol = (whereMatch[2] || whereMatch[4]).toLowerCase();
    whereBind = whereMatch[3] || whereMatch[5];
    log.debug("handleUpdate whereCol/whereBind (normalized)", { whereCol, whereBind });
  }

  const tableObj = db.get(tableKey);
  let changes = 0;
  let rowsRead = 0;
  // Skip schema row for updates: only update data rows, never the schema row
  const dataRows = tableObj ? filterSchemaRow(tableObj.rows) : [];
  log.debug("handleUpdate dataRows (schema row skipped)", { dataRows });

  // Strict: only allow updates to columns defined in the schema row
  const canonicalCols = tableObj && tableObj.rows[0] ? Object.keys(tableObj.rows[0]).map(k => k.toLowerCase()) : [];
  if (!canonicalCols.includes(setCol)) {
    throw d1Error('COLUMN_NOT_FOUND', setCol);
  }

  if (whereMatch && whereCol && whereBind) {
    // Accept bind arg names case-insensitively
    const bindKeys = Object.keys(bindArgs);
    const setBindKey = bindKeys.find(k => k.toLowerCase() === setBind.toLowerCase());
    const whereBindKey = bindKeys.find(k => k.toLowerCase() === whereBind!.toLowerCase());
    if (!setBindKey) throw new Error(`Missing bind argument: ${setBind}`);
    if (!whereBindKey) throw new Error(`Missing bind argument: ${whereBind}`);
    // Use canonical columns from schema row for column matching, normalized
    const matchResults = dataRows.map((row, i) => {
      const normRow = normalizeRowToSchema(tableObj!.rows[0], row);
      return { i, row, normRow, matches: evaluateWhereClause(`${whereCol} = :${whereBind}`, normRow, bindArgs) };
    });
    log.debug("handleUpdate matchesWhere results", matchResults);
    for (const row of dataRows) {
      const normRow = normalizeRowToSchema(tableObj!.rows[0], row);
      const rowKeys = Object.keys(row).map(k => k.toLowerCase());
      const whereRowKey = canonicalCols.find(k => k === whereCol) || rowKeys.find(k => k === whereCol);
      let setRowKey = canonicalCols.find(k => k === setCol) || rowKeys.find(k => k === setCol);
      if (whereRowKey && setRowKey && evaluateWhereClause(`${whereCol} = :${whereBind}`, normRow, bindArgs)) {
        if (setBindKey && row[setRowKey] !== bindArgs[setBindKey]) {
          // Stringify JSON-serializable objects/arrays
          let value = bindArgs[setBindKey];
          if (typeof value === 'object' && value !== null) {
            try {
              value = JSON.stringify(value);
            } catch {
              log.error("Unsupported data type in update", { value });
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
    if (!setBindKey) throw new Error(`Missing bind argument: ${setBind}`);
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
            log.error("Unsupported data type in update", { value });
            throw new Error("Unsupported data type");
          }
        }
        row[setRowKey] = value;
        changes++;
        log.debug("handleUpdate updated row", { rowIndex: i, setRowKey, newValue: value });
      } else {
        log.debug("handleUpdate skipped row (no bind value)", { rowIndex: i, setRowKey });
      }
      rowsRead++;
    }
  }

  log.debug("handleUpdate final table rows (normalized)", { tableKey, tableObj: tableObj?.rows });
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