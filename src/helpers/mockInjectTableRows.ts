/**
 * @file helpers/mockInjectTableRows.ts
 * @description Test-only utility for injecting rows into a mock D1 database table.
 * @warning This is for test/mocking purposes only and should not be used in production code.
 */

/**
 * Injects rows into a table in the mock D1 database (test helper only).
 * Handles schema row creation, patching, and normalization.
 * Throws if schema row is empty and a non-empty row is injected (strict mode).
 * Throws if extra columns are present in injected rows.
 * @param db - The database Map.
 * @param tableName - The table name.
 * @param rows - The rows to inject.
 */
export function injectTableRows(
  db: Map<string, { rows: Record<string, unknown>[] }>,
  tableName: string,
  rows: Record<string, unknown>[]
): void {
  const normalizedTableName = tableName.toLowerCase();
  let table = db.get(normalizedTableName);

  if (!table) {
    // Always create a schema row based on the union of all keys in injected rows
    const schema = rows.length > 0 ? Array.from(new Set(rows.flatMap(row => Object.keys(row)))) : [];
    const schemaRow: Record<string, unknown> = {};
    for (const col of schema) schemaRow[col] = undefined;
    db.set(normalizedTableName, {
      rows: [schemaRow],
    });
    table = db.get(normalizedTableName);
  }

  // Table exists
  const tableRows = db.get(normalizedTableName)!.rows;
  if (rows.length === 0) {
    // If no rows, just keep the schema row (do not clear it)
    db.set(normalizedTableName, { rows: tableRows.slice(0, 1) });
    return;
  }
  let canonicalCols: string[];
  if (tableRows.length === 0) {
    canonicalCols = Object.keys(rows[0]);
    if (canonicalCols.length === 0) {
      // Only allow empty schema row if row is actually empty
      // (do nothing, leave as empty)
    } else {
      const schemaRow: Record<string, unknown> = {};
      for (const col of canonicalCols) schemaRow[col] = undefined;
      tableRows.push(schemaRow);
    }
  } else {
    canonicalCols = Object.keys(tableRows[0]);
    const schemaRow = tableRows[0];
    const isEmptySchema = Object.keys(schemaRow).length === 0 || Object.values(schemaRow).every(v => typeof v === 'undefined' || v === null);
    if (isEmptySchema && rows.some(r => Object.keys(r).length > 0)) {
      // Instead of throwing, replace the schema row with a new one based on the union of all injected row keys
      const schema = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
      const newSchemaRow: Record<string, unknown> = {};
      for (const col of schema) newSchemaRow[col] = undefined;
      tableRows[0] = newSchemaRow;
      canonicalCols = schema;
    }
  }
  for (const row of rows) {
    const normalizedRow: Record<string, unknown> = {};
    for (const col of canonicalCols) {
      const matchKey = Object.keys(row).find(k => k.toLowerCase() === col.toLowerCase());
      normalizedRow[col] = matchKey ? row[matchKey] : null;
    }
    const extraCols = Object.keys(row).filter(k => !canonicalCols.some(c => c.toLowerCase() === k.toLowerCase()));
    if (extraCols.length > 0) {
      throw new Error(`Injected row contains columns not present in schema: ${extraCols.join(", ")}`);
    }
    tableRows.push(normalizedRow);
  }
}