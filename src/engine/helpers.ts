import { D1Row } from "../types/MockD1Database";

/**
 * Matches rows against a WHERE condition with bind arguments.
 * @param _row - The row to match.
 * @param _cond - The WHERE condition.
 * @param _bindArgs - The bind arguments.
 * @returns True if the row matches the condition, false otherwise.
 */
export function matchesWhere(
  _row: D1Row,
  _cond: string,
  _bindArgs?: Record<string, unknown>
): boolean {
  if (!_bindArgs || !_cond) return false;

  // Lowercase all row keys for case-insensitive matching
  const normRow = Object.fromEntries(Object.entries(_row).map(([k, v]) => [k.toLowerCase(), v]));

  // Split on OR first (lowest precedence)
  const orGroups = _cond.split(/\s+OR\s+/i);
  for (const group of orGroups) {
    // Each group: split on AND (higher precedence)
    const andConds = group.split(/\s+AND\s+/i);
    const andResult = andConds.every(cond => {
      // Support only equality: key = :bind, allow quoted/keyword columns
      const m = cond.match(/([`"[?)([\w$]+)\1\s*=\s*:(\w+)/);
      if (!m) return false;
      const [, , key, bind] = m;
      const normKey = key.toLowerCase();
      return normRow[normKey] === _bindArgs[bind];
    });
    if (andResult) return true; // If any OR group is true, return true
  }
  return false; // None matched
}

/**
 * Filters out the schema row (first row with all undefined values) from a table's rows.
 * @param rows - The array of D1Row objects (table rows)
 * @returns The rows array without the schema row
 */
export function filterSchemaRow(rows: D1Row[]): D1Row[] {
  if (!rows.length) return rows;
  const firstRow = rows[0];
  const allUndefined = Object.values(firstRow).every(v => typeof v === 'undefined');
  return allUndefined ? rows.slice(1) : rows;
}

/**
 * Finds the actual table key in the db Map for a given table name, case-insensitively.
 * @param db - The database Map
 * @param table - The table name to look up
 * @returns The actual key in the db Map, or undefined if not found
 */
export function findTableKey(db: Map<string, unknown>, table: string): string | undefined {
  return Array.from(db.keys()).find(k => k.toLowerCase() === table.toLowerCase());
}
