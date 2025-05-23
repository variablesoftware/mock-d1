import { D1Row } from "../../types/MockD1Database";
import { extractTableName } from '../tableUtils/tableNameUtils.js';
import { findTableKey } from '../tableUtils/tableLookup.js';
import { d1Error } from '../errors.js';
import { validateSqlOrThrow } from '../sqlValidation.js';

/**
 * Handles DROP TABLE <table> statements.
 */
export function handleDropTable(
  sql: string,
  db: Map<string, { rows: D1Row[] }>
) {
  validateSqlOrThrow(sql);
  let tableName: string;
  try {
    tableName = extractTableName(sql, 'DROP');
  } catch (err) {
    throw new Error("Malformed DROP TABLE statement.");
  }
  const tableKey = findTableKey(db, tableName);
  if (!tableKey) throw d1Error('TABLE_NOT_FOUND', tableName);
  db.delete(tableKey);
  return {
    success: true,
    results: [],
    meta: {
      duration: 0, size_after: 0, rows_read: 0, rows_written: 0,
      last_row_id: 0, changed_db: true, changes: 0,
    },
  };
}