import { D1Row, D1TableData } from "../../types/MockD1Database";
import { filterSchemaRow, summarizeValue, summarizeRow } from "../../helpers/index.js";
import { log } from "@variablesoftware/logface";
import { evaluateWhereAst } from '../where/whereEvaluator.js';
import { extractTableName } from '../tableUtils/tableNameUtils.js';
import { findTableKey, findColumnKey } from '../tableUtils/tableLookup.js';
import { validateRowAgainstSchema, normalizeRowToSchema } from '../tableUtils/schemaUtils.js';
import { handleAlterTableDropColumn } from './handleAlterTableDropColumn.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';
import { parseWhereClause } from '../where/whereParser.js';

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
  db: Map<string, D1TableData>,
  bindArgs: Record<string, unknown>,
  mode: "all" | "first"
) {
  validateSqlOrThrow(sql);
  const isStress = process.env.D1_STRESS === '1';
  const isDebug = process.env.DEBUG === '1';
  if (!isStress || isDebug) {
    log.debug("called", { sql });
  }
  log.debug("checking for multiple statements", { sql });
  // Disallow multiple statements: only allow a single trailing semicolon (if any)
  const sqlTrimmed = sql.trim();
  const firstSemicolon = sqlTrimmed.indexOf(";");
  const lastSemicolon = sqlTrimmed.lastIndexOf(";");
  if (
    firstSemicolon !== -1 &&
    lastSemicolon !== sqlTrimmed.length - 1 // not just a trailing semicolon
  ) {
    if (isDebug) log.debug("multiple statements detected, throwing", { sql });
    throw new Error("Malformed SQL: multiple statements detected");
  }
  log.debug("checked for multiple statements", { sql });

  // Check for ALTER TABLE ... DROP COLUMN
  if (/^alter table \S+ drop column /i.test(sql)) {
    return handleAlterTableDropColumn();
  }

  // SELECT COUNT(*) FROM ...
  if (/^select count\(\*\) from/i.test(sql)) {
    const tableName = extractTableName(sql, 'SELECT');
    const tableKey = findTableKey(db, tableName);
    log.debug("SELECT COUNT(*) tableKey", { tableName, tableKey });
    if (!tableKey) {
      if (isDebug) log.error("TABLE_NOT_FOUND", { tableName, sql });
      throw d1Error('TABLE_NOT_FOUND', tableName);
    }
    const tableData = db.get(tableKey);
    const rows = tableData?.rows ?? [];
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
    if (!tableKey) {
      if (isDebug) log.error("TABLE_NOT_FOUND", { tableName, sql });
      throw d1Error('TABLE_NOT_FOUND', tableName);
    }
    const tableData = db.get(tableKey);
    const rows = tableData?.rows ?? [];
    const filteredRows = filterSchemaRow(rows);
    // Extract columns (normalize to lower-case for lookups)
    const cols = selectColsMatch[1].split(",").map(s => s.trim().replace(/^[`"[]?(.*?)[`"]?$/, "$1").toLowerCase());
    // WHERE clause support for SELECT <columns>
    if (isDebug) {
      const previewRows = rows.length > 0 ? rows.slice(0, 1).map(summarizeRow) : [];
      log.debug("before filtering", { tableKey, previewRows, rowCount: rows.length });
    }
    let filtered = filteredRows;
    try {
      const whereMatch = sql.match(/where\s*(.*)$/i);
      if (whereMatch) {
        const cond = whereMatch[1];
        if (!cond || cond.trim().length === 0) {
          if (isDebug) log.debug("Malformed WHERE clause detected: blank or whitespace", { sql, whereMatch });
          throw new Error("Malformed WHERE clause: empty or incomplete condition");
        }
        // Additional validation: disallow WHERE ending with OR/AND or only an operator
        const trimmedCond = cond.trim();
        if (/\b(AND|OR)\s*$/i.test(trimmedCond)) {
          if (isDebug) log.debug("Malformed WHERE clause: ends with operator", { sql, cond });
          throw new Error("Malformed WHERE clause: ends with operator");
        }
        if (/^(AND|OR)$/i.test(trimmedCond)) {
          if (isDebug) log.debug("Malformed WHERE clause: only operator", { sql, cond });
          throw new Error("Malformed WHERE clause: only operator");
        }
        // Disallow WHERE with no valid condition (e.g., WHERE OR)
        if (!/\w+\s*=\s*[^\s]+/.test(trimmedCond) && !/IS\s+(NOT\s+)?NULL/i.test(trimmedCond)) {
          if (isDebug) log.debug("Malformed WHERE clause: no valid condition", { sql, cond });
          throw new Error("Malformed WHERE clause: no valid condition");
        }
        const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
        for (const name of bindNames) {
          if (!(name in bindArgs)) {
            if (isDebug) log.error("Missing bind argument in SELECT", { name, sql, bindArgs: summarizeValue(bindArgs) });
            throw new Error(`Missing bind argument: ${name}`);
          }
        }
        const normBindArgs = Object.fromEntries(Object.entries(bindArgs).map(([k, v]) => [k.toLowerCase(), v]));
        const ast = parseWhereClause(cond);
        filtered = filteredRows.filter(row => {
          const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
          return evaluateWhereAst(ast, normRow, normBindArgs);
        });
        log.debug("SELECT <columns> filtered rows", { filteredLength: filtered.length });
      }
      if (isDebug) {
        const previewRows = filtered.length > 0 ? filtered.slice(0, 1).map(summarizeRow) : [];
        log.debug("after filtering", { tableKey, previewRows, filteredCount: filtered.length });
      }
    } catch (err) {
      if (isDebug) log.error("filtering error", { tableKey, rows: rows.map(summarizeRow), bindArgs: summarizeValue(bindArgs), error: err });
      throw err;
    }
    const results = (mode === "first" ? filtered.slice(0, 1) : filtered).map(row => {
      const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      const obj: Record<string, unknown> = {};
      for (const col of cols) {
        const colKey = findColumnKey(tableData?.columns || [], col);
        if (!colKey) {
          if (isDebug) log.error("COLUMN_NOT_FOUND", { col, normRow, sql });
          throw d1Error('COLUMN_NOT_FOUND', col);
        }
        obj[col] = colKey in normRow ? normRow[colKey] : null;
      }
      return obj;
    });
    log.debug("SELECT <columns> results (normalized)", { previewResults: results.length > 0 ? results.slice(0, 1).map(summarizeRow) : [], resultCount: results.length });
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
  if (!tableKey) {
    if (isDebug) log.error("TABLE_NOT_FOUND", { tableName, sql });
    throw d1Error('TABLE_NOT_FOUND', tableName);
  }
  const tableData = db.get(tableKey);
  const rows = tableData?.rows ?? [];
  const filteredRows = filterSchemaRow(rows);
  if (isDebug) {
    const previewRows = rows.length > 0 ? rows.slice(0, 1).map(summarizeRow) : [];
    log.debug("before filtering", { tableKey, previewRows, rowCount: rows.length });
  }
  let filtered = filteredRows;
  try {
    const whereMatch = sql.match(/where\s*(.*)$/i);
    log.debug("SELECT * whereMatch", { whereMatch });
    if (whereMatch) {
      const cond = whereMatch[1];
      if (!cond || cond.trim().length === 0) {
        if (isDebug) log.debug("Malformed WHERE clause detected: blank or whitespace", { sql, whereMatch });
        throw new Error("Malformed WHERE clause: empty or incomplete condition");
      }
      // Additional validation: disallow WHERE ending with OR/AND or only an operator
      const trimmedCond = cond.trim();
      if (/\b(AND|OR)\s*$/i.test(trimmedCond)) {
        if (isDebug) log.debug("Malformed WHERE clause: ends with operator", { sql, cond });
        throw new Error("Malformed WHERE clause: ends with operator");
      }
      if (/^(AND|OR)$/i.test(trimmedCond)) {
        if (isDebug) log.debug("Malformed WHERE clause: only operator", { sql, cond });
        throw new Error("Malformed WHERE clause: only operator");
      }
      // Disallow WHERE with no valid condition (e.g., WHERE OR)
      if (!/\w+\s*=\s*[^\s]+/.test(trimmedCond) && !/IS\s+(NOT\s+)?NULL/i.test(trimmedCond)) {
        if (isDebug) log.debug("Malformed WHERE clause: no valid condition", { sql, cond });
        throw new Error("Malformed WHERE clause: no valid condition");
      }
      const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
      for (const name of bindNames) {
        if (!(name in bindArgs)) {
          if (isDebug) log.error("Missing bind argument in SELECT", { name, sql, bindArgs: summarizeValue(bindArgs) });
          throw new Error(`Missing bind argument: ${name}`);
        }
      }
      const normBindArgs = Object.fromEntries(Object.entries(bindArgs).map(([k, v]) => [k.toLowerCase(), v]));
      const ast = parseWhereClause(cond);
      filtered = filteredRows.filter(row => {
        const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
        return evaluateWhereAst(ast, normRow, normBindArgs);
      });
      log.debug("SELECT * filtered rows", { filteredLength: filtered.length });
    }
    if (isDebug) {
      const previewRows = filtered.length > 0 ? filtered.slice(0, 1).map(summarizeRow) : [];
      log.debug("after filtering", { tableKey, previewRows, filteredCount: filtered.length });
    }
  } catch (err) {
    if (isDebug) log.error("filtering error", { tableKey, rows: rows.map(summarizeRow), bindArgs: summarizeValue(bindArgs), error: err });
    throw err;
  }
  // Fix: schemaCols should be array of column names (not .toLowerCase() on object)
  const schemaCols = tableData?.columns.map(col => col.quoted ? col.name : col.name.toLowerCase()) || [];
  const results = (mode === "first" ? filtered.slice(0, 1) : filtered).map(row => {
    const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
    validateRowAgainstSchema(tableData?.columns || [], normRow);
    const normalized = normalizeRowToSchema(tableData?.columns || [], normRow);
    const obj: Record<string, unknown> = {};
    for (const key of schemaCols) {
      // Fix: pass columns array, not normalized row, to findColumnKey
      const colKey = findColumnKey(tableData?.columns || [], key);
      if (!colKey) {
        if (isDebug) log.error("COLUMN_NOT_FOUND", { key, normalized, sql });
        throw d1Error('COLUMN_NOT_FOUND', key);
      }
      obj[key] = colKey in normalized ? normalized[colKey] : null;
    }
    return obj;
  });
  log.debug("SELECT * results (normalized)", { previewResults: results.length > 0 ? results.slice(0, 1).map(summarizeRow) : [], resultCount: results.length });
  if (!isStress) {
    log.info("select * complete", { rowCount: results.length });
  }
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