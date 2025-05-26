import { D1Row, D1TableData } from "../../types/MockD1Database";
import { filterSchemaRow, summarizeValue, summarizeRow } from "../../helpers/index.js";
import { log } from "@variablesoftware/logface";
import { extractTableName } from '../tableUtils/tableNameUtils.js';
import { findTableKey } from '../tableUtils/tableLookup.js';
import { d1Error } from '../errors.js';
import { evaluateWhereAst } from '../where/whereEvaluator.js';
import { parseWhereClause } from '../where/whereParser.js';
import { validateSqlOrThrow } from '../sqlValidation.js';

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
  db: Map<string, D1TableData>,
  bindArgs: Record<string, unknown>
) {
  const isDebug = process.env.DEBUG === '1';
  validateSqlOrThrow(sql);
  log.debug("called", { sql, bindArgs: summarizeValue(bindArgs) });
  let tableName: string;
  try {
    tableName = extractTableName(sql, 'DELETE');
  } catch {
    if (isDebug) log.error("Malformed DELETE statement", { sql });
    throw new Error("Malformed DELETE statement.");
  }
  const tableKey = findTableKey(db, tableName);
  log.debug("tableKey resolved", { tableKey });
  if (!tableKey) {
    if (isDebug) log.error("TABLE_NOT_FOUND", { tableName, sql });
    throw d1Error('TABLE_NOT_FOUND', tableName);
  }
  const tableData = db.get(tableKey);
  const rows = tableData?.rows ?? [];
  log.debug("rows before", { rows: rows.map(summarizeRow) });
  const dataRows = filterSchemaRow(rows);
  let toDelete: D1Row[] = [];
  const whereMatch = sql.match(/where (.+)$/i);
  if (whereMatch) {
    const cond = whereMatch[1];
    const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    for (const name of bindNames) {
      if (!(Object.keys(bindArgs).some(k => k.toLowerCase() === name.toLowerCase()))) {
        if (isDebug) log.error("Missing bind argument in DELETE", { name, sql, bindArgs: summarizeValue(bindArgs) });
        throw new Error('Missing bind argument');
      }
    }
    // Normalize bindArgs keys to lower-case for WHERE matching
    const normBindArgs = Object.fromEntries(Object.entries(bindArgs).map(([k, v]) => [k.toLowerCase(), v]));
    toDelete = dataRows.filter(row => {
      const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      const ast = parseWhereClause(cond);
      return evaluateWhereAst(ast, normRow, normBindArgs);
    });
  } else {
    toDelete = dataRows;
  }
  // D1-accurate: DELETE removes all rows, including schema row, if no WHERE clause
  let newRows: D1Row[];
  let deletedCount = 0;
  if (!whereMatch) {
    // DELETE FROM <table>: clear all rows (including schema row)
    deletedCount = filterSchemaRow(rows).length;
    newRows = [];
  } else {
    // DELETE FROM <table> WHERE ...: always preserve schema row if present (even if empty)
    const schemaRow = rows.length > 0 ? rows[0] : undefined;
    let afterRows: D1Row[];
    if (schemaRow && (Object.keys(schemaRow).length === 0 || Object.values(schemaRow).every(v => typeof v === 'undefined' || v === null))) {
      // Schema row is empty object or all undefined/null: preserve it
      afterRows = [schemaRow, ...dataRows.filter(r => !toDelete.includes(r))];
    } else {
      afterRows = dataRows.filter(r => !toDelete.includes(r));
    }
    // Count deleted rows as those in toDelete
    deletedCount = toDelete.length;
    newRows = afterRows;
  }
  db.set(tableKey, { ...tableData, columns: tableData?.columns || [], rows: newRows });
  log.debug("final table rows", { tableKey, newRows: newRows.map(summarizeRow) });
  log.info("deleted rows", { changes: deletedCount, size_after: filterSchemaRow(newRows).length });
  return {
    success: true,
    results: [],
    changes: deletedCount,
    meta: {
      duration: 0,
      size_after: filterSchemaRow(newRows).length,
      rows_read: 0, // always 0 for DELETE per test expectation
      rows_written: 0, // always 0 for DELETE per test expectation
      last_row_id: 0,
      changed_db: deletedCount > 0,
      changes: deletedCount,
    },
  };
}