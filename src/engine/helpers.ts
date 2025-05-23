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
  // If the row is a schema row (all values undefined or empty object), never match
  if (Object.keys(_row).length === 0 || Object.values(_row).every(v => typeof v === 'undefined')) return false;

  // Lowercase all row keys for case-insensitive matching
  const normRow = Object.fromEntries(Object.entries(_row).map(([k, v]) => [k.toLowerCase(), v]));
  const normBindArgs = Object.fromEntries(Object.entries(_bindArgs).map(([k, v]) => [k.toLowerCase(), v]));

  // Recursively evaluate the condition with correct operator precedence (AND binds tighter than OR)
  function evalExpr(expr: string): boolean {
    // Match quoted or unquoted column names: `col`, "col", [col], or col
    const m = expr.match(/^[`"\[]?([\w$ ]+)[`"\]]?\s*=\s*:(\w+)$/);
    if (!m) return false;
    const [, key, bind] = m;
    const normKey = key.toLowerCase();
    const normBind = bind.toLowerCase();
    let rowVal = normRow[normKey];
    if (typeof rowVal === 'undefined' && key in _row) rowVal = _row[key];
    if (typeof rowVal === 'undefined') {
      for (const [k, v] of Object.entries(_row)) {
        if (k.toLowerCase() === normKey) {
          rowVal = v;
          break;
        }
      }
    }
    if (!(normBind in normBindArgs)) return false;
    return rowVal === normBindArgs[normBind];
  }

  function evalCond(cond: string): boolean {
    cond = cond.trim();
    // Split on OR at the top level (lowest precedence)
    let orParts: string[] = [];
    let depth = 0, last = 0;
    for (let i = 0; i <= cond.length - 2; i++) {
      if (cond[i] === '(') depth++;
      if (cond[i] === ')') depth--;
      if (
        depth === 0 &&
        cond.slice(i, i + 2).toUpperCase() === 'OR' &&
        (!/\w/.test(cond[i - 1] || '')) &&
        (!/\w/.test(cond[i + 2] || ''))
      ) {
        orParts.push(cond.slice(last, i).trim());
        last = i + 2;
        i += 1;
      }
    }
    if (orParts.length) {
      orParts.push(cond.slice(last).trim());
      return orParts.some(part => evalCond(part));
    }
    // Split on AND at the top level (higher precedence than OR)
    let andParts: string[] = [];
    depth = 0; last = 0;
    for (let i = 0; i <= cond.length - 3; i++) {
      if (cond[i] === '(') depth++;
      if (cond[i] === ')') depth--;
      if (
        depth === 0 &&
        cond.slice(i, i + 3).toUpperCase() === 'AND' &&
        (!/\w/.test(cond[i - 1] || '')) &&
        (!/\w/.test(cond[i + 3] || ''))
      ) {
        andParts.push(cond.slice(last, i).trim());
        last = i + 3;
        i += 2;
      }
    }
    if (andParts.length) {
      andParts.push(cond.slice(last).trim());
      return andParts.every(part => evalCond(part));
    }
    // Base case: single expression
    return evalExpr(cond);
  }

  return evalCond(_cond);
}

/**
 * Filters out the schema row (first row with all undefined values or empty object) from a table's rows.
 * @param rows - The array of D1Row objects (table rows)
 * @returns The rows array without the schema row
 */
export function filterSchemaRow(rows: D1Row[]): D1Row[] {
  if (!rows.length) return rows;
  const firstRow = rows[0];
  // Treat as schema row if all values undefined/null or if the object is empty
  const isSchemaRow =
    (Object.keys(firstRow).length === 0) ||
    Object.values(firstRow).every(v => typeof v === 'undefined' || v === null);
  return isSchemaRow ? rows.slice(1) : rows;
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
