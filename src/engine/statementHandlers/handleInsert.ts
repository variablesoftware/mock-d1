import { D1Row } from "../../types/MockD1Database";
import { z, RefinementCtx } from "zod";
import { findTableKey, filterSchemaRow } from "../helpers.js";
import { log } from "@variablesoftware/logface";

// Accept any JSON-serializable value except function, symbol, bigint, undefined
const bindArgsSchema = z.record(z.string(), z.any()).superRefine((args: Record<string, unknown>, ctx: RefinementCtx) => {
  for (const [key, value] of Object.entries(args)) {
    if (
      typeof value === 'function' ||
      typeof value === 'symbol' ||
      typeof value === 'bigint' ||
      typeof value === 'undefined'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `Unsupported data type`
      });
    }
    // Only allow JSON-serializable objects/arrays
    if (typeof value === 'object' && value !== null) {
      try {
        JSON.stringify(value);
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `Unsupported data type`
        });
      }
    }
  }
});

/**
 * Handles INSERT INTO <table> (...) VALUES (...) statements for the mock D1 engine.
 * Inserts a new row into the specified table using the provided bind arguments.
 *
 * @param sql - The SQL INSERT statement string.
 * @param db - The in-memory database map.
 * @param bindArgs - The named bind arguments for the statement.
 * @returns An object representing the result of the INSERT operation.
 * @throws If the SQL statement is malformed or the column/bind count does not match.
 */
export function handleInsert(
  sql: string,
  db: Map<string, { rows: D1Row[] }>,
  bindArgs: Record<string, unknown> = {} // Default to an empty object
) {
  const isDebug = process.env.DEBUG === '1';
  if (isDebug) log.debug("called", { sql, bindArgs });

  // Validate bind arguments
  try {
    bindArgsSchema.parse(bindArgs);
  } catch (e) {
    log.error("bindArgs validation failed", { bindArgs, error: e });
    throw new Error("Unsupported data type");
  }

  // Relaxed regex: allow quoted identifiers, SQL keywords, and bracketed names
  const tableMatch = sql.match(/insert into\s+([`"[])?([\w$]+)\1?/i);
  const colMatch = sql.match(/\(([^)]+)\)/);
  const valuesMatch = sql.match(/values\s*\(([^)]+)\)/i);

  if (!tableMatch || !colMatch || !valuesMatch) {
    log.error("malformed INSERT", { sql });
    throw new Error("Malformed INSERT statement");
  }

  if (isDebug) log.debug("regex matches", { tableMatch, colMatch, valuesMatch });

  // Extract table name, strip quotes if present, and normalize to lower-case
  const table = tableMatch[2].toLowerCase();
  // Case-insensitive table lookup using helper
  let tableKey = findTableKey(db, table);
  if (!tableKey) {
    // Auto-create table with schema row using columns from insert
    log.debug("auto-creating table", { table });
    const schemaRow: Record<string, unknown> = {};
    const columns = colMatch[1].split(",").map(s => s.trim().replace(/^[`"[]?(.*?)[`"\]]?$/, "$1").toLowerCase());
    for (const col of columns) schemaRow[col] = undefined;
    db.set(table, { rows: [schemaRow] });
    tableKey = table;
  }
  const tableData = db.get(tableKey);
  if (!tableData) {
    log.error("missing tableData after lookup", { tableKey });
    throw new Error(`Table '${table}' does not exist in the database.`);
  }

  if (isDebug) log.debug("normalized table name", { raw: tableMatch[1] + tableMatch[2] + tableMatch[1], table });
  if (isDebug) log.debug("tableKey", { table, tableKey });

  // Normalize columns to lower-case for all lookups and assignments
  const columns = colMatch[1].split(",").map(s => s.trim().replace(/^[`"[]?(.*?)[`"\]]?$/, "$1").toLowerCase());
  const values = valuesMatch[1].split(",").map(s => s.trim());

  if (columns.length !== values.length) {
    log.error("column/value count mismatch", { columns, values });
    throw new Error("INSERT column/value count mismatch.");
  }

  if (isDebug) log.debug("columns/values (normalized)", { columns, values });

  // Accept bind arg names and column names case-insensitively, and allow SQL keywords as names
  const bindKeys = Object.keys(bindArgs);
  // Build row using either bind values or direct literals
  const row: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    // Find bind key case-insensitively
    const bindKey = bindKeys.find(k => k.toLowerCase() === col);
    let value;
    if (bindKey) {
      value = bindArgs[bindKey];
    } else {
      // Try to parse as a literal (number, string, null)
      const raw = values[i];
      if (/^null$/i.test(raw)) {
        value = null;
      } else if (/^['"](.*)['"]$/.test(raw)) {
        value = raw.replace(/^['"]|['"]$/g, "");
      } else if (!isNaN(Number(raw))) {
        value = Number(raw);
      } else {
        value = raw; // fallback: store as string
      }
    }
    // Only allow primitives/null/undefined, or plain objects/arrays (JSON-serializable)
    if (typeof value === 'object' && value !== null) {
      // Only allow plain objects or arrays
      if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) {
        log.error("unsupported object type", { value });
        throw new Error("Unsupported data type");
      }
      try {
        value = JSON.stringify(value);
      } catch (err) {
        log.error("JSON.stringify failed", { value, err });
        throw new Error("Unsupported data type");
      }
    }
    row[col] = value;
    log.debug("assigned value", { col, value });
  }

  // Get canonical columns from the first row (set by CREATE TABLE), normalize to lower-case
  let canonicalCols = tableData.rows[0] ? Object.keys(tableData.rows[0]).map(k => k.toLowerCase()) : columns;
  if (canonicalCols.length === 0 && columns.length > 0) {
    for (const col of columns) {
      tableData.rows[0][col] = undefined;
    }
    canonicalCols = columns;
    if (isDebug) log.debug("patched schema row for dynamic table (normalized)", { canonicalCols, tableRows: tableData.rows });
  }

  if (isDebug) log.debug("canonicalCols (normalized)", { canonicalCols, tableRows: tableData.rows });

  // Use bindKeys from earlier in the function
  const normalizedRow: Record<string, unknown> = {};
  if (canonicalCols.length === 0) {
    if (isDebug) log.debug("inserting into table with no columns", { tableKey });
    if (tableData.rows.length && Object.values(tableData.rows[0]).every(v => typeof v === 'undefined')) {
      tableData.rows.splice(1, 0, {});
    } else {
      tableData.rows.push({});
    }
  } else {
    for (const canonicalCol of canonicalCols) {
      // Find matching column in the insert statement (case-insensitive, normalized)
      const insertColIdx = columns.findIndex(c => c === canonicalCol);
      if (insertColIdx !== -1) {
        // Use value from row (already parsed above)
        normalizedRow[canonicalCol] = row[canonicalCol];
      } else {
        normalizedRow[canonicalCol] = null;
      }
    }
    if (isDebug) log.debug("inserting normalizedRow (normalized)", { normalizedRow, tableKey });
    if (tableData.rows.length && Object.values(tableData.rows[0]).every(v => typeof v === 'undefined')) {
      tableData.rows.splice(1, 0, normalizedRow);
    } else {
      tableData.rows.push(normalizedRow);
    }
  }

  if (isDebug) log.debug("final table rows", { tableKey, rows: tableData.rows });
  log.info("handleInsert: row inserted", { tableKey, rowCount: tableData.rows.length });
  return {
    success: true,
    results: [],
    meta: {
      duration: 0,
      size_after: filterSchemaRow(tableData.rows).length,
      rows_read: 0,
      rows_written: 1,
      last_row_id: tableData.rows.length,
      changed_db: true,
      changes: 1,
    },
  };
}