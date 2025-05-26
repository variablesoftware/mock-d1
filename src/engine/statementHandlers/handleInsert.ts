import { D1Row } from "../../types/MockD1Database";
import { z, RefinementCtx } from "zod";
import { findTableKey, filterSchemaRow, summarizeValue, summarizeRow } from "../../helpers/index.js";
import { log } from "@variablesoftware/logface";
import { extractTableName, normalizeTableName } from '../tableUtils/tableNameUtils.js';
import { validateRowAgainstSchema, normalizeRowToSchema } from '../tableUtils/schemaUtils.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';
import type { D1TableData } from "../../types/MockD1Database";

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
  db: Map<string, D1TableData>,
  bindArgs: Record<string, unknown> = {} // Default to an empty object
) {
  // Validate SQL (including malformed) at run-time
  validateSqlOrThrow(sql);

  // Only log debug info if not in stress mode
  const isStress = process.env.D1_STRESS === '1';
  const isDebug = process.env.DEBUG === '1';
  if (!isStress || !isDebug) {
    log.debug("called", { sql, bindArgs: summarizeValue(bindArgs) });
  }

  // Parse columns and values from SQL
  const colMatch = sql.match(/insert into\s+([`"])?(\w+)\1?(?:\s*\(([^)]*)\))?/i);
  const valuesMatch = sql.match(/values\s*\(([^)]+)\)/i);
  if (!colMatch || !valuesMatch) {
    if (isDebug) log.error("malformed INSERT", { sql });
    throw d1Error('MALFORMED_INSERT');
  }
  if (sql.indexOf(colMatch[0]) > sql.indexOf(valuesMatch[0])) {
    if (isDebug) log.error("malformed INSERT: columns after values", { sql });
    throw d1Error('MALFORMED_INSERT');
  }
  const columns = colMatch[3]
    ? colMatch[3].split(",").map(s => {
        const trimmed = s.trim();
        const quotedMatch = trimmed.match(/^([`"\[])(.+)\1/);
        if (quotedMatch) {
          return { name: quotedMatch[2], quoted: true, original: quotedMatch[0] };
        } else {
          return { name: trimmed, quoted: false, original: trimmed };
        }
      }).filter(c => c.name)
    : [];
  const values = valuesMatch[1] ? valuesMatch[1].split(",").map(s => s.trim()) : [];

  // Check for missing bind arguments BEFORE column/value count mismatch
  for (let i = 0; i < values.length; i++) {
    const valueExpr = values[i];
    const bindMatch = valueExpr.match(/^:(.+)$/);
    if (bindMatch) {
      const bindName = bindMatch[1];
      if (!(bindName in bindArgs)) {
        throw new Error('Missing bind argument');
      }
    }
  }

  // 1. Throw if column/value count mismatch
  if (columns.length !== values.length || columns.length === 0) {
    throw d1Error('MALFORMED_INSERT', 'Column/value count mismatch in INSERT');
  }

  // 2. Throw if duplicate column names
  // Only declare here, and do not redeclare above
  const seenUnquotedInsert = new Set<string>();
  const seenQuotedInsert = new Set<string>();
  for (const col of columns) {
    if (col.quoted) {
      if (seenQuotedInsert.has(col.name)) {
        throw d1Error('MALFORMED_INSERT', 'Duplicate column name in INSERT');
      }
      seenQuotedInsert.add(col.name);
    } else {
      const lower = col.name.toLowerCase();
      if (seenUnquotedInsert.has(lower)) {
        throw d1Error('MALFORMED_INSERT', 'Duplicate column name in INSERT');
      }
      seenUnquotedInsert.add(lower);
    }
  }
  // 3. Skip insert if all values are undefined/null (including bind values)
  if (values.every((v, i) => {
    const bindMatch = v && typeof v === 'string' && v.match(/^:(.+)$/);
    if (bindMatch) {
      const bindName = bindMatch[1];
      // Only treat as undefined if the key is present and value is undefined/null
      return (bindName in bindArgs) ? (bindArgs[bindName] === undefined || bindArgs[bindName] === null) : false;
    }
    return v === undefined || v === null || v === 'undefined' || v === 'null';
  })) {
    // Check if any bind placeholder is missing as a key in bindArgs
    const missingBind = values.some((v, i) => {
      const bindMatch = v && typeof v === 'string' && v.match(/^:(.+)$/);
      if (bindMatch) {
        const bindName = bindMatch[1];
        // Only throw if the key is not present at all
        return !(bindName in bindArgs);
      }
      return false;
    });
    if (missingBind) {
      throw new Error('Missing bind argument');
    }
    let tableName: string = '';
    try {
      tableName = extractTableName(sql, 'INSERT');
    } catch {}
    let tableKey = tableName ? findTableKey(db, tableName) : undefined;
    let tableData = (tableKey && db.has(tableKey)) ? db.get(tableKey) : undefined;
    // D1: no-op insert should return success: false
    return { success: false, results: [], meta: { changes: 0, rows_written: 0, last_row_id: tableData && tableData.rows ? tableData.rows.length : 0 } };
  }

  // Validate bind arguments
  try {
    bindArgsSchema.parse(bindArgs);
  } catch (e) {
    log.error("bindArgs validation failed", { bindArgs: summarizeValue(bindArgs), error: e });
    throw new Error("Unsupported data type");
  }

  let tableName: string;
  try {
    tableName = extractTableName(sql, 'INSERT');
  } catch {
    throw new Error("Malformed INSERT statement");
  }
  let tableKey = findTableKey(db, tableName);
  let tableData = tableKey ? db.get(tableKey) : undefined;

  // If table does not exist, auto-create with D1-accurate key logic
  if (!tableKey || !tableData) {
    const colMatch = sql.match(/insert into\s+([`"])?(\w+)\1?(?:\s*\(([^)]*)\))?/i);
    const columns = colMatch && colMatch[3]
      ? colMatch[3].split(",").map(s => {
          const trimmed = s.trim();
          const quotedMatch = trimmed.match(/^([`"\[])(.+)\1/);
          if (quotedMatch) {
            return { name: quotedMatch[2], quoted: true, original: quotedMatch[0] };
          } else {
            return { name: trimmed, quoted: false, original: trimmed };
          }
        }).filter(c => c.name)
      : [];
    const newTableKey = normalizeTableName(tableName);
    db.set(newTableKey, { columns, rows: [] });
    tableKey = newTableKey;
    tableData = db.get(tableKey);
    if (!isStress) {
      log.debug("auto-creating table", { tableName, newTableKey, columns });
    }
  }
  if (!tableData) throw d1Error('TABLE_NOT_FOUND', tableName);

  // --- Normalize columns to array (compatibility with object schema) ---
  let columnsArr: { name: string; quoted: boolean; original: string }[];
  if (Array.isArray(tableData.columns)) {
    columnsArr = tableData.columns.map(c => ({
      name: c.name,
      quoted: c.quoted,
      original: c.original ?? c.name
    }));
  } else {
    columnsArr = Object.keys(tableData.columns).map(k => ({
      name: k,
      quoted: false,
      original: k
    }));
  }

  // Throw if column/value count mismatch
  if (columnsArr.length !== values.length || columnsArr.length === 0) {
    throw d1Error('MALFORMED_INSERT', 'Column/value count mismatch in INSERT');
  }
  // Throw if duplicate column names (only check once here)
  const seenUnquoted = new Set<string>();
  const seenQuoted = new Set<string>();
  for (const col of columnsArr) {
    if (col.quoted) {
      if (seenQuoted.has(col.name)) {
        throw d1Error('MALFORMED_INSERT', 'Duplicate column name in INSERT');
      }
      seenQuoted.add(col.name);
    } else {
      const lower = col.name.toLowerCase();
      if (seenUnquoted.has(lower)) {
        throw d1Error('MALFORMED_INSERT', 'Duplicate column name in INSERT');
      }
      seenUnquoted.add(lower);
    }
  }

  // If all values are undefined/null, skip insert and return success
  if (values.every(v => v === undefined || v === null || v === 'undefined' || v === 'null')) {
    return { success: true, results: [], meta: { changes: 0, rows_written: 0, last_row_id: tableData.rows.length } };
  }

  // Accept bind arg names and column names case-insensitively, and allow SQL keywords as names
  const bindKeys = Object.keys(bindArgs);
  const normBindArgs = Object.fromEntries(bindKeys.map(k => [k.toLowerCase(), bindArgs[k]]));

  // Check for missing bind arguments before proceeding, and also check for malformed value expressions
  for (let i = 0; i < values.length; i++) {
    const valueExpr = values[i];
    const bindMatch = valueExpr.match(/^:(.+)$/);
    if (!bindMatch) {
      if (isDebug) log.error("Non-bind value in VALUES clause (not supported)", { valueExpr, sql });
      throw d1Error('MALFORMED_INSERT');
    }
    const bindName = bindMatch[1].toLowerCase();
    if (!(bindName in normBindArgs)) {
      if (isDebug) log.error("Missing bind argument (diagnostic)", {
        col: columns[i] ? columns[i].name : undefined,
        columns,
        bindKeys,
        normBindArgsKeys: Object.keys(normBindArgs),
        schemaKeys: columns.map(c => c.name),
        sql,
        bindArgs: summarizeValue(bindArgs),
        normBindArgs,
        bindName,
        valueExpr,
      });
      // Always throw MISSING_BIND for missing bind arguments at runtime
      throw new Error('Missing bind argument');
    }
  }

  // Build row using bind parameter names from VALUES clause
  const row: Record<string, unknown> = Object.create(null);
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const valueExpr = values[i];
    const bindMatch = valueExpr.match(/^:(.+)$/);
    if (!bindMatch) {
      log.error("Non-bind value in VALUES clause (not supported)", { valueExpr, sql });
      throw d1Error('MALFORMED_INSERT');
    }
    const bindName = bindMatch[1].toLowerCase();
    let value = normBindArgs[bindName];
    if (typeof value === 'object' && value !== null) {
      if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) {
        log.error("unsupported object type", { value: summarizeValue(value) });
        throw new Error("Unsupported data type");
      }
      try {
        value = JSON.stringify(value);
      } catch (err) {
        log.error("JSON.stringify failed", { value: summarizeValue(value), err });
        throw new Error("Unsupported data type");
      }
    }
    row[col.quoted ? col.name : col.name.toLowerCase()] = value;
    if (!isStress) {
      log.debug("assigned value", { col: col.name, value: summarizeValue(value) });
    }
  }

  // Guard: do not insert a row if all values are undefined
  const allUndefined = columns.every(col => row[col.quoted ? col.name : col.name.toLowerCase()] === undefined);
  if (allUndefined) {
    // Check if any value is undefined due to missing bind argument
    const missingBind = columns.some((col, i) => {
      const valueExpr = values[i];
      const bindMatch = valueExpr && typeof valueExpr === 'string' && valueExpr.match(/^:(.+)$/);
      if (bindMatch) {
        const bindName = bindMatch[1].toLowerCase();
        return !(bindName in normBindArgs);
      }
      return false;
    });
    if (missingBind) {
      // Always throw the specific error for missing bind argument
      throw new Error('Missing bind argument');
    }
    log.warn("Skipping insert of all-undefined row", { tableKey, row });
    return {
      success: false,
      results: [],
      meta: {
        duration: 0,
        size_after: tableData.rows.length,
        rows_read: 0,
        rows_written: 0,
        last_row_id: tableData.rows.length,
        changed_db: false,
        changes: 0,
      },
    };
  }

  tableData.rows.push(row);

  if (!isStress) {
    log.debug("final table rows", { tableKey, rowCount: tableData.rows.length });
    log.info("row inserted", { tableKey, rowCount: tableData.rows.length });
  }
  return {
    success: true,
    results: [],
    meta: {
      duration: 0,
      size_after: tableData.rows.length,
      rows_read: 0,
      rows_written: 1,
      last_row_id: tableData.rows.length,
      changed_db: true,
      changes: 1,
    },
  };
}