import type { D1TableData } from "../../types/MockD1Database";
import { extractTableName } from '../tableUtils/tableNameUtils.js';
import { findTableKey } from '../tableUtils/tableLookup.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';
import { log } from "@variablesoftware/logface";

/**
 * Handles DROP TABLE <table> statements.
 */
export function handleDropTable(
  sql: string,
  db: Map<string, D1TableData>
) {
  log.debug("handleDropTable called", { sql });
  validateSqlOrThrow(sql);
  let tableName: string;
  try {
    tableName = extractTableName(sql, 'DROP');
  } catch (err) {
    log.error("Malformed DROP TABLE statement", { sql, err });
    throw d1Error('MALFORMED_DROP');
  }
  const tableKey = findTableKey(db, tableName);
  log.debug("handleDropTable tableKey", { tableName, tableKey });
  if (!tableKey) {
    log.error("Table not found for DROP TABLE", { tableName });
    throw d1Error('TABLE_NOT_FOUND', tableName);
  }
  db.delete(tableKey);
  log.info("Table dropped", { tableKey });
  return {
    success: true,
    results: [],
    meta: {
      duration: 0, size_after: 0, rows_read: 0, rows_written: 0,
      last_row_id: 0, changed_db: true, changes: 0,
    },
  };
}