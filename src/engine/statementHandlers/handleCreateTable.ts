import { D1Row, D1TableData } from "../../types/MockD1Database";
import { extractTableName, normalizeTableName } from '../tableUtils/tableNameUtils.js';
import { handleAlterTableDropColumn } from './handleAlterTableDropColumn.js';
import { d1Error } from '../errors.js';
import { log } from "@variablesoftware/logface";

function vitestMeta(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    VITEST_POOL_ID: process.env.VITEST_POOL_ID,
    VITEST_WORKER_ID: process.env.VITEST_WORKER_ID
  };
}

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
    log.debug("called", vitestMeta({ sql }));
  }
  // Check for malformed CREATE (e.g., 'CREATE foo') and throw UNSUPPORTED_SQL instead of MALFORMED_CREATE
  if (/^CREATE\s+[^\s]+/i.test(sql) && !/^CREATE\s+TABLE/i.test(sql)) {
    log.error("Malformed CREATE (not CREATE TABLE)", vitestMeta({ sql }));
    throw d1Error('UNSUPPORTED_SQL');
  }
  // Check for ALTER TABLE ... DROP COLUMN and delegate to handleAlterTableDropColumn
  if (/^alter table \S+ drop column /i.test(sql)) {
    log.debug("Delegating to handleAlterTableDropColumn", vitestMeta({ sql }));
    return handleAlterTableDropColumn();
  }

  log.debug("Entered", vitestMeta({ sql }));
  // Use shared utility for table name extraction and normalization
  try {
    let tableName: string;
    let tableKey: string;
    try {
      tableName = extractTableName(sql, 'CREATE');
      tableKey = normalizeTableName(tableName);
    } catch (err) {
      log.error("Malformed CREATE TABLE (table name extraction failed)", vitestMeta({ sql, err }));
      throw d1Error('UNSUPPORTED_SQL');
    }
    log.debug("Table name extracted", vitestMeta({ tableName, tableKey }));
    log.debug("Existence check", vitestMeta({
      sql,
      tableName,
      tableKey,
      dbKeys: Array.from(db.keys()),
      hasIfNotExists: /if not exists/i.test(sql),
      tableExists: db.has(tableKey),
    }));
    if (db.has(tableKey)) {
      if (/if not exists/i.test(sql)) {
        log.info("IF NOT EXISTS: table already exists, skipping", vitestMeta({ tableName, tableKey }));
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
      log.error("Table already exists", vitestMeta({ tableName, tableKey, sql }));
      throw d1Error('GENERIC', `Table already exists: ${tableName}`);
    }
    const colMatch = sql.match(/create table\s+(if not exists\s+)?([`"\[]?\w+[`"\]]?)\s*\(([^)]*)\)/i);
    log.debug("colMatch", vitestMeta({ colMatch }));
    log.debug("colMatch after regex", vitestMeta({ colMatch }));
    if (!colMatch || typeof colMatch[3] !== 'string') {
      log.error("Malformed CREATE TABLE (regex failed or missing parens)", vitestMeta({ sql, colMatch }));
      // Only allow empty parens as valid (handled below), otherwise throw UNSUPPORTED_SQL
      throw d1Error('UNSUPPORTED_SQL');
    }
    const colSection = colMatch[3].trim();
    log.debug("colSection before column parse", vitestMeta({ colSection }));
    // Accept empty parens as a valid empty table (per test expectations)
    if (colSection === '') {
      log.info("Created empty table (no columns, colSection empty string)", vitestMeta({
        sql,
        colMatch,
        colSection,
        tableKey
      }));
      db.set(tableKey, { columns: [], rows: [] });
      log.debug("db.set for empty table", vitestMeta({ tableKey, columns: [], rows: [] }));
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
        log.debug("Parsing column", vitestMeta({ raw: s, trimmed }));
        if (!trimmed) return null;
        const quotedMatch = trimmed.match(/^([`"\[])(.+)\1/);
        if (quotedMatch) {
          log.debug("Column is quoted", vitestMeta({ quotedMatch }));
          return { original: quotedMatch[0], name: quotedMatch[2], quoted: true };
        } else {
          const name = trimmed.split(/\s+/)[0];
          log.debug("Column is unquoted", vitestMeta({ name }));
          if (!name) return null;
          return { original: name, name, quoted: false };
        }
      }).filter((c): c is { original: string, name: string, quoted: boolean } => !!c && !!c.name);
    }
    log.debug("Columns after parse/filter", vitestMeta({ columns }));
    if (colSection !== '' && !columns.length) {
      log.error("Malformed CREATE TABLE (no valid columns after parse)", vitestMeta({
        sql,
        colMatch,
        colSection,
        columns,
        tableKey
      }));
      throw d1Error('UNSUPPORTED_SQL');
    }
    // Check for duplicate columns (quoted and unquoted must not overlap)
    const seenUnquoted = new Set<string>();
    const seenQuoted = new Set<string>();
    for (const col of columns) {
      log.debug("Checking column for duplicates", vitestMeta({ col, seenUnquoted: Array.from(seenUnquoted), seenQuoted: Array.from(seenQuoted) }));
      if (col.quoted) {
        if (seenQuoted.has(col.name) || seenUnquoted.has(col.name.toLowerCase())) {
          log.error("Duplicate quoted column in CREATE TABLE", vitestMeta({
            tableKey,
            col
          }));
          throw d1Error('UNSUPPORTED_SQL');
        }
        seenQuoted.add(col.name);
      } else {
        const lower = col.name.toLowerCase();
        if (seenUnquoted.has(lower) || seenQuoted.has(col.name)) {
          log.error("Duplicate unquoted column in CREATE TABLE", vitestMeta({
            tableKey,
            col
          }));
          throw d1Error('UNSUPPORTED_SQL');
        }
        seenUnquoted.add(lower);
      }
    }
    log.debug("db.set for table with columns", vitestMeta({ tableKey, columns }));
    db.set(tableKey, { columns, rows: [] });
    log.info("Created table with columns", vitestMeta({ tableKey, columns: columns.map(c => c.name) }));
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
    log.error("Exception thrown", vitestMeta({
      sql,
      err
    }));
    // Always re-throw errors so that the promise is rejected and tests can catch them
    throw err;
  }
}