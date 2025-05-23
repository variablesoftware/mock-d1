import { D1Row } from "../../types/MockD1Database";
import { z, RefinementCtx } from "zod";
import { findTableKey, filterSchemaRow } from "../helpers.js";
import { log } from "@variablesoftware/logface";
import { extractTableName, normalizeTableName, getTableKey } from '../tableUtils/tableNameUtils.js';
import { findTableKey, findColumnKey } from '../tableUtils/tableLookup.js';
import { validateRowAgainstSchema, normalizeRowToSchema } from '../tableUtils/schemaUtils.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';

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
  validateSqlOrThrow(sql);
  log.debug("called", { sql, bindArgs });

  // Validate bind arguments
  try {
    bindArgsSchema.parse(bindArgs);
  } catch (e) {
    log.error("bindArgs validation failed", { bindArgs, error: e });
    throw new Error("Unsupported data type");
  }

  let tableName: string;
  try {
    tableName = extractTableName(sql, 'INSERT');
  } catch (err) {
    throw new Error("Malformed INSERT statement");
  }
  let tableKey = findTableKey(db, tableName);
  if (!tableKey) throw d1Error('TABLE_NOT_FOUND', tableName);
  const colMatch = sql.match(/\(([^)]+)\)/);
  const valuesMatch = sql.match(/values\s*\(([^)]+)\)/i);

  if (!colMatch || !valuesMatch) {
    log.error("malformed INSERT", { sql });
    throw new Error("Malformed INSERT statement");
  }
  if (sql.indexOf(colMatch[0]) > sql.indexOf(valuesMatch[0])) {
    log.error("malformed INSERT: columns after values", { sql });
    throw new Error("Malformed INSERT statement");
  }

  // If table does not exist, auto-create with D1-accurate key logic
  if (!tableKey) {
    const newTableKey = normalizeTableName(tableName);
    log.debug("auto-creating table", { tableName, newTableKey });
    const schemaRow: Record<string, unknown> = {};
    const columns = colMatch[1].split(",").map(s => s.trim().replace(/^[`"\[]?(.*?)[`"\]]?$/, "$1").toLowerCase());
    for (const col of columns) schemaRow[col] = undefined;
    db.set(newTableKey, { rows: [schemaRow] });
    tableKey = newTableKey;
  }
  const tableData = db.get(tableKey);
  if (!tableData) {
    log.error("missing tableData after lookup", { tableKey });
    throw new Error(`Table '${tableName}' does not exist in the database.`);
  }
  log.debug("normalized table name", { raw: tableName });
  log.debug("tableKey", { tableName, tableKey });

  // Normalize columns to lower-case for all lookups and assignments
  const columns = colMatch[1].split(",").map(s => s.trim().replace(/^[`"\[]?(.*?)[`"\]]?$/, "$1").toLowerCase());
  const values = valuesMatch[1].split(",").map(s => s.trim());

  if (columns.length !== values.length) {
    log.error("column/value count mismatch", { columns, values });
    throw new Error("INSERT column/value count mismatch.");
  }

  // Accept bind arg names and column names case-insensitively, and allow SQL keywords as names
  const bindKeys = Object.keys(bindArgs);
  // Build row using only bind values (strict D1: do not fallback to literals)
  const row: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    // Find bind key case-insensitively
    const bindKey = bindKeys.find(k => k.toLowerCase() === col);
    if (!bindKey) {
      throw new Error(`Missing bind argument: ${col}`);
    }
    let value = bindArgs[bindKey];
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
  const canonicalCols = tableData.rows[0] ? Object.keys(tableData.rows[0]).map(k => k.toLowerCase()) : columns;
  // Strict: do not patch schema row with new columns
  if (canonicalCols.length !== columns.length || !columns.every(col => canonicalCols.includes(col))) {
    throw new Error("Attempted to insert with columns not present in schema");
  }

  // Validate and normalize row against schema
  validateRowAgainstSchema(tableData.rows[0], row);
  const normalizedRow = normalizeRowToSchema(tableData.rows[0], row);

  log.debug("inserting normalizedRow (normalized)", { normalizedRow, tableKey });
  if (tableData.rows.length && Object.values(tableData.rows[0]).every(v => typeof v === 'undefined')) {
    tableData.rows.splice(1, 0, normalizedRow);
  } else {
    tableData.rows.push(normalizedRow);
  }

  log.debug("final table rows", { tableKey, rows: tableData.rows });
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