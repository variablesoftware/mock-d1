import { D1Row, D1TableData } from "../../types/MockD1Database";
import { extractTableName, normalizeTableName } from '../tableUtils/tableNameUtils.js';
import { handleAlterTableDropColumn } from './handleAlterTableDropColumn.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';
import { log } from "@variablesoftware/logface";
log.options({tag:`VITEST_POOL_ID: ${process.env.VITEST_POOL_ID}, VITEST_WORKER_ID: ${process.env.VITEST_WORKER_ID}`})
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
  db: Map<string, D1TableData>
) {
  const isStress = process.env.D1_STRESS === '1';
  if (!isStress) {
    log.debug("called", { sql });
  }
  validateSqlOrThrow(sql);
  // Check for ALTER TABLE ... DROP COLUMN and delegate to handleAlterTableDropColumn
  if (/^alter table \S+ drop column /i.test(sql)) {
    log.debug("Delegating to handleAlterTableDropColumn", { sql });
    return handleAlterTableDropColumn();
  }

  log.debug("Entered", { sql });
  // Use shared utility for table name extraction and normalization
  try {
    const tableName = extractTableName(sql, 'CREATE');
    const tableKey = normalizeTableName(tableName);
    log.debug("Table name extracted", { tableName, tableKey });
    log.debug("Existence check", {
      sql,
      tableName,
      tableKey,
      dbKeys: Array.from(db.keys()),
      hasIfNotExists: /if not exists/i.test(sql),
      tableExists: db.has(tableKey),
    });
    if (db.has(tableKey)) {
      if (/if not exists/i.test(sql)) {
        log.info("IF NOT EXISTS: table already exists, skipping", { tableName, tableKey });
        return {
          success: true,
          results: [],
          meta: {
            duration: 0,
            size_after: db.get(tableKey)?.rows.length ?? 0,
            rows_read: 0,
            rows_written: 0,
            last_row_id: 0,
            changed_db: false,
            changes: 0,
          },
        };
      }
      log.error("Table already exists", {
        tableName,
        tableKey,
        sql,
        dbKeys: Array.from(db.keys()),
        VITEST_POOL_ID: process.env.VITEST_POOL_ID,
        VITEST_WORKER_ID: process.env.VITEST_WORKER_ID
      });
      throw d1Error('GENERIC', `Table already exists: ${tableName}`);
    }
    const colMatch = sql.match(/create table\s+(if not exists\s+)?([`"\[]?\w+[`"\]]?)\s*\(([^)]*)\)/i);
    log.debug("colMatch", { colMatch });
    log.debug("colMatch after regex", { colMatch });
    if (!colMatch || typeof colMatch[3] !== 'string') {
      log.error("Malformed CREATE TABLE (regex failed or missing parens)", {
        sql,
        colMatch,
        VITEST_POOL_ID: process.env.VITEST_POOL_ID,
        VITEST_WORKER_ID: process.env.VITEST_WORKER_ID
      });
      throw d1Error('UNSUPPORTED_SQL');
    }
    const colSection = colMatch[3].trim();
    log.debug("colSection before column parse", { colSection });
    if (colSection === '') {
      log.info("Created empty table (no columns, colSection empty string)", { tableKey });
      db.set(tableKey, { columns: [], rows: [] });
      log.debug("db.set for empty table", { tableKey, columns: [], rows: [] });
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
    let columns: { original: string, name: string, quoted: boolean }[] = [];
    if (colSection !== '') {
      columns = colSection.split(",").map(s => {
        const trimmed = s.trim();
        log.debug("Parsing column", { raw: s, trimmed });
        if (!trimmed) return null;
        const quotedMatch = trimmed.match(/^([`"\[])(.+)\1/);
        if (quotedMatch) {
          log.debug("Column is quoted", { quotedMatch });
          return { original: quotedMatch[0], name: quotedMatch[2], quoted: true };
        } else {
          const name = trimmed.split(/\s+/)[0];
          log.debug("Column is unquoted", { name });
          if (!name) return null;
          return { original: name, name, quoted: false };
        }
      }).filter((c): c is { original: string, name: string, quoted: boolean } => !!c && !!c.name);
    }
    log.debug("Columns after parse/filter", { columns });
    if (colSection !== '' && !columns.length) {
      log.error("Malformed CREATE TABLE (no valid columns after parse)", {
        sql,
        colMatch,
        colSection,
        columns,
        tableKey,
        VITEST_POOL_ID: process.env.VITEST_POOL_ID,
        VITEST_WORKER_ID: process.env.VITEST_WORKER_ID
      });
      throw d1Error('UNSUPPORTED_SQL');
    }
    // Check for duplicate columns (quoted and unquoted must not overlap)
    const seenUnquoted = new Set<string>();
    const seenQuoted = new Set<string>();
    for (const col of columns) {
      log.debug("Checking column for duplicates", { col, seenUnquoted: Array.from(seenUnquoted), seenQuoted: Array.from(seenQuoted) });
      if (col.quoted) {
        if (seenQuoted.has(col.name) || seenUnquoted.has(col.name.toLowerCase())) {
          log.error("Duplicate quoted column in CREATE TABLE", {
            tableKey,
            col,
            VITEST_POOL_ID: process.env.VITEST_POOL_ID,
            VITEST_WORKER_ID: process.env.VITEST_WORKER_ID
          });
          throw d1Error('UNSUPPORTED_SQL');
        }
        seenQuoted.add(col.name);
      } else {
        const lower = col.name.toLowerCase();
        if (seenUnquoted.has(lower) || seenQuoted.has(col.name)) {
          log.error("Duplicate unquoted column in CREATE TABLE", {
            tableKey,
            col,
            VITEST_POOL_ID: process.env.VITEST_POOL_ID,
            VITEST_WORKER_ID: process.env.VITEST_WORKER_ID
          });
          throw d1Error('UNSUPPORTED_SQL');
        }
        seenUnquoted.add(lower);
      }
    }
    log.debug("db.set for table with columns", { tableKey, columns });
    db.set(tableKey, { columns, rows: [] });
    log.info("Created table with columns", { tableKey, columns: columns.map(c => c.name) });
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
  } catch (err) {
    log.error("Exception thrown", {
      sql,
      err,
      VITEST_POOL_ID: process.env.VITEST_POOL_ID,
      VITEST_WORKER_ID: process.env.VITEST_WORKER_ID
    });
    // Always re-throw errors so that the promise is rejected and tests can catch them
    throw err;
  }
}