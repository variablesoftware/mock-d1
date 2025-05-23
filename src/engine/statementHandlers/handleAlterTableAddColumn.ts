import { D1Row } from "../../types/MockD1Database";
import { filterSchemaRow } from "../helpers.js";
import { extractTableName } from '../tableUtils/tableNameUtils.js';
import { findTableKey, findColumnKey } from '../tableUtils/tableLookup.js';
import { validateRowAgainstSchema, normalizeRowToSchema } from '../tableUtils/schemaUtils.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';

/**
 * Handles ALTER TABLE <table> ADD COLUMN <col> statements (stub).
 */
export function handleAlterTableAddColumn(
  sql: string,
  db: Map<string, { rows: D1Row[] }>
) {
  validateSqlOrThrow(sql);
  let tableName: string;
  try {
    tableName = extractTableName(sql, 'ALTER');
  } catch (err) {
    throw new Error("Malformed ALTER TABLE ADD COLUMN statement.");
  }
  const match = sql.match(/add column (\S+)(?:\s+(\w+))?/i);
  if (!match) throw new Error("Malformed ALTER TABLE ADD COLUMN statement.");
  const col = match[1];
  const type = match[2];
  const tableKey = findTableKey(db, tableName);
  if (!tableKey) throw d1Error('TABLE_NOT_FOUND', tableName);
  if (type && !/^(INTEGER|TEXT|REAL|BLOB)$/i.test(type)) {
    throw new Error(`Unsupported column type: ${type}`);
  }
  const tableObj = db.get(tableKey);
  if (!tableObj || !Array.isArray(tableObj.rows) || !tableObj.rows[0]) throw d1Error('TABLE_NOT_FOUND', tableName);
  // Add column to schema row if present
  if (tableObj.rows.length && Object.values(tableObj.rows[0]).every(v => typeof v === 'undefined')) {
    const schemaRow = tableObj.rows[0];
    if (!schemaRow) throw d1Error('TABLE_NOT_FOUND', tableName);
    const colKey = findColumnKey(schemaRow, col);
    if (!colKey) throw d1Error('COLUMN_NOT_FOUND', col);
    if (!(Object.keys(schemaRow).some(k => k.toLowerCase() === colKey.toLowerCase()))) {
      schemaRow[col] = undefined;
    }
  }
  // Add column to all data rows
  for (const row of filterSchemaRow(tableObj.rows)) {
    if (!row) throw d1Error('TABLE_NOT_FOUND', tableName);
    const colKey = findColumnKey(row, col);
    if (!colKey) throw d1Error('COLUMN_NOT_FOUND', col);
    if (!(Object.keys(row).some(k => k.toLowerCase() === colKey.toLowerCase()))) {
      row[col] = undefined;
    }
    validateRowAgainstSchema(row, tableObj.rows[0]);
    normalizeRowToSchema(row, tableObj.rows[0]);
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