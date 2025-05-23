import { D1Row } from "../../types/MockD1Database";
import { filterSchemaRow } from "../helpers.js";
import { log } from "@variablesoftware/logface";
import { evaluateWhereClause } from '../where/evaluateWhereClause.js';
import { extractTableName } from '../tableUtils/tableNameUtils.js';
import { findTableKey, findColumnKey } from '../tableUtils/tableLookup.js';
import { validateRowAgainstSchema, normalizeRowToSchema } from '../tableUtils/schemaUtils.js';
import { handleAlterTableDropColumn } from './handleAlterTableDropColumn.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';

/**
 * Handles SELECT * FROM <table> [WHERE ...] statements for the mock D1 engine.
 * Retrieves rows from the specified table, optionally filtered by a WHERE clause.
 *
 * @param sql - The SQL SELECT statement string.
 * @param db - The in-memory database map.
 * @param bindArgs - The named bind arguments for the statement.
 * @param mode - "all" to return all matching rows, "first" to return only the first.
 * @returns An object representing the result of the SELECT operation.
 * @throws If the SQL statement is malformed or required bind arguments are missing.
 */
export function handleSelect(
  sql: string,
  db: Map<string, { rows: D1Row[] }>,
  bindArgs: Record<string, unknown>,
  mode: "all" | "first"
) {
  validateSqlOrThrow(sql);
  log.debug("called", { sql });
  log.debug("handleSelect: checking for multiple statements", { sql });
  // Disallow multiple statements: only allow a single trailing semicolon (if any)
  const sqlTrimmed = sql.trim();
  const firstSemicolon = sqlTrimmed.indexOf(";");
  const lastSemicolon = sqlTrimmed.lastIndexOf(";");
  if (
    firstSemicolon !== -1 &&
    lastSemicolon !== sqlTrimmed.length - 1 // not just a trailing semicolon
  ) {
    log.debug("handleSelect: multiple statements detected, throwing", { sql });
    throw new Error("Malformed SQL: multiple statements detected");
  }
  log.debug("handleSelect: checked for multiple statements", { sql });

  // Check for ALTER TABLE ... DROP COLUMN
  if (/^alter table \S+ drop column /i.test(sql)) {
    return handleAlterTableDropColumn();
  }

  // SELECT COUNT(*) FROM ...
  if (/^select count\(\*\) from/i.test(sql)) {
    const tableName = extractTableName(sql, 'SELECT');
    const tableKey = findTableKey(db, tableName);
    log.debug("SELECT COUNT(*) tableKey", { tableName, tableKey });
    if (!tableKey) throw d1Error('TABLE_NOT_FOUND', tableName);
    const rows = db.get(tableKey)?.rows ?? [];
    const filteredRows = filterSchemaRow(rows);
    log.debug("SELECT COUNT(*) rows", { rowsLength: filteredRows.length });
    return {
      success: true,
      results: [{ "COUNT(*)": filteredRows.length }],
      meta: {
        duration: 0,
        size_after: filteredRows.length,
        rows_read: filteredRows.length,
        rows_written: 0,
        last_row_id: rows.length,
        changed_db: false,
        changes: 0,
      },
    };
  }

  // SELECT <columns> FROM <table>
  const selectColsMatch = sql.match(/^select ([^*]+) from/i);
  if (selectColsMatch) {
    const tableName = extractTableName(sql, 'SELECT');
    const tableKey = findTableKey(db, tableName);
    log.debug("SELECT <columns> tableKey", { tableName, tableKey });
    if (!tableKey) throw d1Error('TABLE_NOT_FOUND', tableName);
    const rows = db.get(tableKey)?.rows ?? [];
    const filteredRows = filterSchemaRow(rows);
    // Extract columns (normalize to lower-case for lookups)
    const cols = selectColsMatch[1].split(",").map(s => s.trim().replace(/^[`"\[]?(.*?)[`"\]]?$/, "$1").toLowerCase());
    // WHERE clause support for SELECT <columns>
    let filtered = filteredRows;
    const whereMatch = sql.match(/where\s*(.*)$/i);
    if (whereMatch) {
      const cond = whereMatch[1];
      if (!cond || cond.trim().length === 0) {
        log.debug("Malformed WHERE clause detected: blank or whitespace", { sql, whereMatch });
        throw new Error("Malformed WHERE clause: empty or incomplete condition");
      }
      const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
      for (const name of bindNames) {
        if (!(name in bindArgs)) throw new Error(`Missing bind argument: ${name}`);
      }
      const normBindArgs = Object.fromEntries(Object.entries(bindArgs).map(([k, v]) => [k.toLowerCase(), v]));
      filtered = filteredRows.filter(row => {
        const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
        return evaluateWhereClause(cond, normRow, normBindArgs);
      });
      log.debug("SELECT <columns> filtered rows", { filteredLength: filtered.length });
    }
    const results = (mode === "first" ? filtered.slice(0, 1) : filtered).map(row => {
      const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      const obj: Record<string, unknown> = {};
      for (const col of cols) {
        const colKey = findColumnKey(normRow, col);
        if (!colKey) throw d1Error('COLUMN_NOT_FOUND', col);
        obj[col] = colKey in normRow ? normRow[colKey] : null;
      }
      return obj;
    });
    log.debug("SELECT <columns> results (normalized)", { results });
    log.info("select <columns> complete", { rowCount: results.length });
    return {
      success: true,
      results,
      meta: {
        duration: 0,
        size_after: filteredRows.length,
        rows_read: results.length,
        rows_written: 0,
        last_row_id: rows.length,
        changed_db: false,
        changes: 0,
      },
    };
  }

  // SELECT * FROM <table> [WHERE ...]
  const tableName = extractTableName(sql, 'SELECT');
  const tableKey = findTableKey(db, tableName);
  log.debug("SELECT * tableKey", { tableName, tableKey });
  if (!tableKey) throw d1Error('TABLE_NOT_FOUND', tableName);
  const rows = db.get(tableKey)?.rows ?? [];
  const filteredRows = filterSchemaRow(rows);
  let filtered = filteredRows;
  const whereMatch = sql.match(/where\s*(.*)$/i);
  log.debug("SELECT * whereMatch", { whereMatch });
  if (whereMatch) {
    const cond = whereMatch[1];
    if (!cond || cond.trim().length === 0) {
      log.debug("Malformed WHERE clause detected: blank or whitespace", { sql, whereMatch });
      throw new Error("Malformed WHERE clause: empty or incomplete condition");
    }
    const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    for (const name of bindNames) {
      if (!(name in bindArgs)) throw new Error(`Missing bind argument: ${name}`);
    }
    const normBindArgs = Object.fromEntries(Object.entries(bindArgs).map(([k, v]) => [k.toLowerCase(), v]));
    filtered = filteredRows.filter(row => {
      const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      return evaluateWhereClause(cond, normRow, normBindArgs);
    });
    log.debug("SELECT * filtered rows", { filteredLength: filtered.length });
  }
  const schemaRow = rows[0] || {};
  const schemaCols = Object.keys(schemaRow).map(k => k.toLowerCase());
  const results = (mode === "first" ? filtered.slice(0, 1) : filtered).map(row => {
    const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
    validateRowAgainstSchema(schemaRow, normRow);
    const normalized = normalizeRowToSchema(schemaRow, normRow);
    const obj: Record<string, unknown> = {};
    for (const key of schemaCols) {
      const colKey = findColumnKey(normalized, key);
      if (!colKey) throw d1Error('COLUMN_NOT_FOUND', key);
      obj[key] = colKey in normalized ? normalized[colKey] : null;
    }
    return obj;
  });
  log.debug("SELECT * results (normalized)", { results });
  log.info("select * complete", { rowCount: results.length });
  return {
    success: true,
    results,
    meta: {
      duration: 0,
      size_after: filteredRows.length,
      rows_read: results.length,
      rows_written: 0,
      last_row_id: rows.length,
      changed_db: false,
      changes: 0,
    },
  };
}