// matchesWhere was previously split out, but the file is empty. Restore the implementation here.
import type { D1Row } from "../types/MockD1Database";

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
  if (Object.keys(_row).length === 0 || Object.values(_row).every(v => typeof v === 'undefined')) return false;
  const normRow = Object.fromEntries(Object.entries(_row).map(([k, v]) => [k.toLowerCase(), v]));
  const normBindArgs = Object.fromEntries(Object.entries(_bindArgs).map(([k, v]) => [k.toLowerCase(), v]));
  function evalExpr(expr: string): boolean {
    const m = expr.match(/^[`"[]?([\w$ ]+)[`"\]]?\s*=\s*:(\w+)$/);
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
    return evalExpr(cond);
  }
  return evalCond(_cond);
}
