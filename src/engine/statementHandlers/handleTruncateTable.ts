import { D1Row } from "../../types/MockD1Database";
import { extractTableName } from '../tableUtils/tableNameUtils.js';
import { log } from "@variablesoftware/logface";
import { findTableKey } from '../tableUtils/tableLookup.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';

/**
 * Handles TRUNCATE TABLE <table> statements.
 */
export function handleTruncateTable(
  sql: string,
  db: Map<string, { rows: D1Row[] }>
) {
  validateSqlOrThrow(sql);
  log.debug("handleTruncateTable called", { sql });
  let tableName: string;
  try {
    tableName = extractTableName(sql, 'TRUNCATE');
  } catch (err) {
    throw new Error("Malformed TRUNCATE TABLE statement.");
  }
  const tableKey = findTableKey(db, tableName);
  log.debug("handleTruncateTable tableKey lookup", { tableName, tableKey });
  if (!tableKey) {
    log.error("Table does not exist in the database", { tableName });
    throw d1Error('TABLE_NOT_FOUND', tableName);
  }
  // Always remove all rows, including schema row, on TRUNCATE
  db.set(tableKey, { rows: [] });
  log.info("Table truncated", { tableKey });
  return {
    success: true,
    results: [],
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0, rows_written: 0,
      last_row_id: 0, changed_db: true, changes: 0,
    },
  };
}