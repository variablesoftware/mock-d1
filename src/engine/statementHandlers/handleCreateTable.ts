import { D1Row } from "../../types/MockD1Database";
import { extractTableName, normalizeTableName } from '../tableUtils/tableNameUtils.js';
import { findTableKey, findColumnKey } from '../tableUtils/tableLookup.js';
import { handleAlterTableDropColumn } from './handleAlterTableDropColumn.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';

/**
 * Handles CREATE TABLE [IF NOT EXISTS] <table> statements for the mock D1 engine.
 * Adds the table to the in-memory database if it does not already exist.
 *
 * @param sql - The SQL statement string.
 * @param db - The in-memory database map.
 * @returns An object representing the result of the CREATE TABLE operation.
 * @throws If the SQL statement is malformed.
 */
export function handleCreateTable(
  sql: string,
  db: Map<string, { rows: D1Row[] }>
) {
  validateSqlOrThrow(sql);
  // Check for ALTER TABLE ... DROP COLUMN and delegate to handleAlterTableDropColumn
  if (/^alter table \S+ drop column /i.test(sql)) {
    return handleAlterTableDropColumn();
  }

  // Use shared utility for table name extraction and normalization
  const tableName = extractTableName(sql, 'CREATE');
  const tableKey = normalizeTableName(tableName);
  if (db.has(tableKey)) throw d1Error('GENERIC', `Table already exists: ${tableName}`);
  // Parse columns from CREATE TABLE statement
  const colMatch = sql.match(/\(([^)]*)\)/);
  let columns: string[] = [];
  if (!colMatch) {
    // No column list: allow, create empty table (no schema row)
    db.set(tableKey, { rows: [] });
    return {
      success: true,
      results: [],
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: true,
        changes: 0,
      },
    };
  }
  // If columns is empty or only whitespace, throw with the expected error message
  if (!colMatch[1] || /^\s*$/.test(colMatch[1])) {
    throw new Error("Syntax error: CREATE TABLE must define at least one column");
  }
  // Split columns, reject if any are empty (e.g. trailing/leading commas)
  columns = colMatch[1].split(",").map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
  if (columns.length === 0 || columns.some(c => !c)) {
    throw new Error("Malformed CREATE TABLE statement: must define at least one column");
  }
  // Always create a schema row (even for no columns)
  const row: Record<string, unknown> = {};
  for (const col of columns) row[col] = undefined;
  db.set(tableKey, { rows: [row] });
  return {
    success: true,
    results: [],
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: 0,
      last_row_id: 0,
      changed_db: true,
      changes: 0,
    },
  };
}