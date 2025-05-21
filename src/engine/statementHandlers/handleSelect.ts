import { D1Row } from "../../types/MockD1Database";
import { findTableKey, filterSchemaRow } from "../helpers.js";
import { log } from "@variablesoftware/logface";

/**
 * Handles SELECT * FROM <table> [WHERE ...] statements for the mock D1 engine.
 * Retrieves rows from the specified table, optionally filtered by a WHERE clause.
 *
 * @param sql - The SQL SELECT statement string.
 * @param db - The in-memory database map.
 * @param bindArgs - The named bind arguments for the statement.
 * @param matchesWhere - A function to evaluate WHERE clause conditions.
 * @param mode - "all" to return all matching rows, "first" to return only the first.
 * @returns An object representing the result of the SELECT operation.
 * @throws If the SQL statement is malformed or required bind arguments are missing.
 */
export function handleSelect(
  sql: string,
  db: Map<string, { rows: D1Row[] }>,
  bindArgs: Record<string, unknown>,
  matchesWhere: (_row: D1Row, _cond: string, _bindArgs?: Record<string, unknown>) => boolean,
  mode: "all" | "first"
) {
  const isDebug = process.env.DEBUG === '1';
  if (isDebug) log.debug("called", { sql });
  // SELECT COUNT(*) FROM ...
  if (/^select count\(\*\) from/i.test(sql)) {
    // Improved regex: support quoted identifiers, SQL keywords, and bracketed names
    const tableMatch = sql.match(/from\s+([`"[])(.+?)\1|from\s+([\w$]+)/i);
    if (isDebug) log.debug("SELECT COUNT(*) tableMatch", { tableMatch });
    const table = tableMatch ? (tableMatch[2] || tableMatch[3]).toLowerCase() : undefined;
    if (!table) throw new Error("Malformed SELECT COUNT(*) statement.");
    const tableKey = findTableKey(db, table);
    if (isDebug) log.debug("SELECT COUNT(*) tableKey", { table, tableKey });
    if (!tableKey) throw new Error(`Table '${table}' does not exist in the database.`);
    const rows = db.get(tableKey)?.rows ?? [];
    const filteredRows = filterSchemaRow(rows);
    if (isDebug) log.debug("SELECT COUNT(*) rows", { rowsLength: filteredRows.length });
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
  // Improved regex: support quoted identifiers, SQL keywords, and bracketed names
  const selectColsMatch = sql.match(/^select ([^*]+) from\s+([`"[])(.+?)\2|^select ([^*]+) from\s+([\w$]+)/i);
  if (isDebug) log.debug("SELECT <columns> match", { selectColsMatch });
  if (selectColsMatch) {
    // Normalize columns to lower-case for all lookups
    const cols = (selectColsMatch[1] || selectColsMatch[4]).split(",").map(s => s.trim().replace(/^[`"[]?(.*?)[`"\]]?$/, "$1").toLowerCase());
    const table = (selectColsMatch[3] || selectColsMatch[5]).toLowerCase();
    const tableKey = findTableKey(db, table);
    if (isDebug) log.debug("SELECT <columns> tableKey", { table, tableKey });
    if (!tableKey) throw new Error(`Table '${table}' does not exist in the database.`);
    const rows = db.get(tableKey)?.rows ?? [];
    const filteredRows = filterSchemaRow(rows);
    if (isDebug) log.debug("[SELECT <columns> rows", { rowsLength: filteredRows.length, canonicalCols: rows[0] ? Object.keys(rows[0]) : [] });
    // WHERE clause support for SELECT <columns>
    let filtered = filteredRows;
    const whereMatch = sql.match(/where (.+)$/i);
    if (whereMatch) {
      const cond = whereMatch[1];
      const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
      for (const name of bindNames) {
        if (!(name in bindArgs)) throw new Error(`Missing bind argument: ${name}`);
      }
      // Normalize row keys to lower-case for WHERE matching
      if (isDebug) {
        const matchResults = filteredRows.map((row, i) => {
          const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
          return { i, row, normRow, matches: matchesWhere(normRow, cond, bindArgs) };
        });
        log.debug("SELECT <columns> matchesWhere results", matchResults);
      }
      filtered = filteredRows.filter(row => {
        const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
        return matchesWhere(normRow, cond, bindArgs);
      });
      if (isDebug) log.debug("SELECT <columns> filtered rows", { filteredLength: filtered.length });
    }
    // Always use normalized keys for result construction
    const results = (mode === "first" ? filtered.slice(0, 1) : filtered).map(row => {
      const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      const obj: Record<string, unknown> = {};
      for (const col of cols) {
        obj[col] = col in normRow ? normRow[col] : null;
      }
      return obj;
    });
    if (isDebug) log.debug("SELECT <columns> results (normalized)", { results });
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
  // Improved regex: support quoted identifiers, SQL keywords, and bracketed names
  const tableMatch = sql.match(/from\s+([`"[])(.+?)\1|from\s+([\w$]+)/i);
  if (isDebug) log.debug("SELECT * tableMatch", { tableMatch });
  const table = tableMatch ? (tableMatch[2] || tableMatch[3]).toLowerCase() : undefined;
  if (!table) throw new Error("Malformed SELECT statement.");
  const tableKey = findTableKey(db, table);
  if (isDebug) log.debug("SELECT * tableKey", { table, tableKey });
  if (!tableKey) throw new Error(`Table '${table}' does not exist in the database.`);
  const rows = db.get(tableKey)?.rows ?? [];
  const filteredRows = filterSchemaRow(rows);
  if (isDebug) log.debug("SELECT * rows", { rowsLength: filteredRows.length });
  let filtered = filteredRows;
  const whereMatch = sql.match(/where (.+)$/i);
  if (isDebug) log.debug("SELECT * whereMatch", { whereMatch });
  if (whereMatch) {
    const cond = whereMatch[1];
    const bindNames = Array.from(cond.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    for (const name of bindNames) {
      if (!(name in bindArgs)) throw new Error(`Missing bind argument: ${name}`);
    }
    // Normalize row keys to lower-case for WHERE matching
    if (isDebug) {
      const matchResults = filteredRows.map((row, i) => {
        const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
        return { i, row, normRow, matches: matchesWhere(normRow, cond, bindArgs) };
      });
      log.debug("SELECT * matchesWhere results", matchResults);
    }
    filtered = filteredRows.filter(row => {
      const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      return matchesWhere(normRow, cond, bindArgs);
    });
    if (isDebug) log.debug("SELECT * filtered rows", { filteredLength: filtered.length });
  }
  // Use canonical columns from schema row for SELECT *, normalized
  const schemaRow = rows[0] || {};
  const schemaCols = Object.keys(schemaRow).map(k => k.toLowerCase());
  const results = (mode === "first" ? filtered.slice(0, 1) : filtered).map(row => {
    const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
    const obj: Record<string, unknown> = {};
    for (const key of schemaCols) {
      obj[key] = key in normRow ? normRow[key] : null;
    }
    return obj;
  });
  if (isDebug) log.debug("SELECT * results (normalized)", { results });
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