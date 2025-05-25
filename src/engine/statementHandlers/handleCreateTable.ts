import { D1Row, D1TableData } from "../../types/MockD1Database";
import { extractTableName, normalizeTableName } from '../tableUtils/tableNameUtils.js';
import { handleAlterTableDropColumn } from './handleAlterTableDropColumn.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';
import { log } from "@variablesoftware/logface";

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
      log.error("Table already exists", { tableName, tableKey, sql, dbKeys: Array.from(db.keys()) });
      throw d1Error('GENERIC', `Table already exists: ${tableName}`);
    }
    const colMatch = sql.match(/create table\s+(if not exists\s+)?([`"\[]?\w+[`"\]]?)\s*\(([^)]*)\)/i);
    log.debug("colMatch", { colMatch });
    // Allow empty parens as valid (CREATE TABLE foo ())
    if (colMatch && /^\s*$/.test(colMatch[3])) {
      log.info("Created empty table (no columns)", { tableKey });
      db.set(tableKey, { columns: [], rows: [] });
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
    if (!colMatch) {
      log.error("Malformed CREATE TABLE (no parens or invalid)", { sql });
      throw d1Error('UNSUPPORTED_SQL');
    }
    // Parse columns, preserving quoted/unquoted distinction
    let columns = colMatch[3].split(",").map(s => {
      const trimmed = s.trim();
      const quotedMatch = trimmed.match(/^([`"\[])(.+)\1/);
      if (quotedMatch) {
        return { original: quotedMatch[0], name: quotedMatch[2], quoted: true };
      } else {
        const name = trimmed.split(/\s+/)[0].toLowerCase();
        return { original: name, name, quoted: false };
      }
    }).filter(c => c.name);
    log.debug("Parsed columns", { columns });
    // Check for duplicate columns
    const seenUnquoted = new Set<string>();
    const seenQuoted = new Set<string>();
    for (const col of columns) {
      if (col.quoted) {
        if (seenQuoted.has(col.name)) {
          log.error("Duplicate quoted column in CREATE TABLE", { tableKey, col });
          throw d1Error('GENERIC', `Duplicate column in CREATE TABLE: ${col.name}`);
        }
        seenQuoted.add(col.name);
      } else {
        const lower = col.name.toLowerCase();
        if (seenUnquoted.has(lower)) {
          log.error("Duplicate unquoted column in CREATE TABLE", { tableKey, col });
          throw d1Error('GENERIC', `Duplicate column in CREATE TABLE: ${col.name}`);
        }
        seenUnquoted.add(lower);
      }
    }
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
    log.error("Exception thrown", { sql, err });
    throw err;
  }
}