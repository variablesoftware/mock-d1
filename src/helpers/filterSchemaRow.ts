import type { D1Row } from "../types/MockD1Database";

/**
 * Filters out the schema row (first row with all undefined values or empty object) from a table's rows.
 * @param rows - The array of D1Row objects (table rows)
 * @returns The rows array without the schema row
 */
export function filterSchemaRow(rows: D1Row[]): D1Row[] {
  // No-op: schema row is no longer used in new db shape
  return rows;
}
