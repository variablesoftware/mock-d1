import { D1Row, D1TableData } from "../../types/MockD1Database";
import { filterSchemaRow } from "../../helpers/index.js";
import { extractTableName } from '../tableUtils/tableNameUtils.js';
import { findTableKey } from '../tableUtils/tableLookup.js';
import { validateRowAgainstSchema, normalizeRowToSchema } from '../tableUtils/schemaUtils.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';
import { log } from "@variablesoftware/logface";

/**
 * Handles ALTER TABLE <table> ADD COLUMN <col> statements (stub).
 */
export function handleAlterTableAddColumn(
  sql: string,
  db: Map<string, D1TableData>
) {
  log.debug("handleAlterTableAddColumn called", { sql });
  validateSqlOrThrow(sql);
  let tableName: string;
  try {
    tableName = extractTableName(sql, 'ALTER');
  } catch (err) {
    log.error("Malformed ALTER TABLE ADD COLUMN statement", { sql, err });
    throw new Error("Malformed ALTER TABLE ADD COLUMN statement.");
  }
  // Parse column name and quoted status
  // Accepts double quotes, backticks, or square brackets for quoted identifiers
  // Only extract the column name, not the type, for schema
  let colName: string;
  let quoted = false;
  const quotedColMatch = sql.match(/add column\s+([`"\[])(.+?)\1/i);
  if (quotedColMatch) {
    quoted = true;
    colName = quotedColMatch[2];
  } else {
    const unquotedColMatch = sql.match(/add column\s+(\w+)/i);
    if (!unquotedColMatch) {
      log.error("Malformed ALTER TABLE ADD COLUMN statement (regex)", { sql });
      throw new Error("Malformed ALTER TABLE ADD COLUMN statement.");
    }
    colName = unquotedColMatch[1];
  }
  const tableKey = findTableKey(db, tableName);
  log.debug("handleAlterTableAddColumn tableKey", { tableName, tableKey });
  log.debug("handleAlterTableAddColumn existence check", {
    sql,
    tableName,
    tableKey,
    dbKeys: Array.from(db.keys()),
    tableExists: tableKey ? db.has(tableKey) : false,
  });
  if (!tableKey) throw d1Error('TABLE_NOT_FOUND', tableName);
  const tableObj = db.get(tableKey);
  if (!tableObj || !Array.isArray(tableObj.rows) || !tableObj.rows[0]) {
    log.error("Table not found or invalid rows in ALTER TABLE ADD COLUMN", { tableKey });
    throw d1Error('TABLE_NOT_FOUND', tableName);
  }
  // Support both array and object schema for test compatibility
  let columnsArr: { original: string; name: string; quoted: boolean }[];
  if (Array.isArray(tableObj.columns)) {
    columnsArr = tableObj.columns.map(c => ({
      name: c.name,
      quoted: c.quoted,
      original: c.original ?? c.name
    }));
  } else {
    // Legacy object shape (test helpers)
    columnsArr = Object.keys(tableObj.columns).map(k => ({
      original: k,
      name: k,
      quoted: false,
    }));
  }
  // Parse column/type, do not treat type as a column
  let colTypeDef = sql.match(/add column\s+(.+)$/i)?.[1] || '';
  let type = '';
  // Match quoted or unquoted column name and type
  const match = colTypeDef.match(/^([`"\[])?([^`"\]\s]+)\1?\s*(.*)$/);
  if (match) {
    quoted = !!match[1];
    colName = match[2];
    type = match[3] ? match[3].trim() : '';
  } else {
    // fallback: treat as unquoted
    colName = colTypeDef.split(/\s+/)[0];
    type = colTypeDef.slice(colName.length).trim();
  }
  // Check for duplicate columns (case-sensitive for quoted, case-insensitive for unquoted)
  const hasDuplicate = columnsArr.some(c =>
    (quoted && c.quoted && c.name === colName) ||
    (!quoted && !c.quoted && c.name.toLowerCase() === colName.toLowerCase())
  );
  if (hasDuplicate) {
    log.error("Duplicate column in ALTER TABLE ADD COLUMN", { tableKey, col: colName, quoted });
    throw d1Error('GENERIC', `Column already exists: ${colName}`);
  }
  // Add column to schema (only the name, not the type)
  if (Array.isArray(tableObj.columns)) {
    tableObj.columns.push({ original: quoted ? `"${colName}"` : colName, name: colName, quoted });
  } else {
    (tableObj.columns as any)[quoted ? colName : colName.toLowerCase()] = null;
  }
  // Add column to all data rows
  let previewRow: D1Row | undefined;
  let previewRowSet = false;
  for (const row of filterSchemaRow(tableObj.rows)) {
    if (!row) throw d1Error('TABLE_NOT_FOUND', tableName);
    if (quoted) {
      if (!Object.prototype.hasOwnProperty.call(row, colName)) row[colName] = null;
    } else {
      const colKey = colName.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(row, colKey)) {
        row[colKey] = null;
      }
    }
    if (!previewRowSet) {
      previewRow = { ...row };
      previewRowSet = true;
    }
    validateRowAgainstSchema(columnsArr, row);
    normalizeRowToSchema(columnsArr, row);
  }
  if (previewRowSet) {
    log.debug("handleAlterTableAddColumn preview row after add", {
      previewRow,
      addedCol: quoted ? colName : colName.toLowerCase(),
      quoted,
    });
  }
  log.info("ALTER TABLE ADD COLUMN complete", { tableKey, col: colName, schemaKeys: Object.keys(tableObj.columns), schemaRow: { ...tableObj.columns } });
  return {
    success: true,
    results: [],
    meta: {
      duration: 0, size_after: tableObj ? filterSchemaRow(tableObj.rows).length : 0, rows_read: 0, rows_written: 0,
      last_row_id: 0, changed_db: true, changes: 0,
    },
  };
}