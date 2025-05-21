import { D1Row } from "../types/MockD1Database";
import { log } from "@variablesoftware/logface";

/**
 * Evaluates a WHERE clause for a row, supporting AND/OR logic and named bind parameters.
 * Only supports simple equality comparisons (col = :bind).
 *
 * @param row - The row to evaluate.
 * @param cond - The WHERE clause condition string (supports AND/OR).
 * @param bindArgs - The named bind arguments for the statement.
 * @returns True if the row matches the condition, false otherwise.
 * @throws If a required bind argument is missing.
 */
export function matchesWhere(
  row: D1Row,
  cond: string,
  bindArgs: Record<string, unknown>
): boolean {
  // Normalize row keys for case-insensitive matching
  const normRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  // Normalize bind arg keys for case-insensitive matching
  const normBindArgs = Object.fromEntries(Object.entries(bindArgs).map(([k, v]) => [k.toLowerCase(), v]));

  // Helper to evaluate a single expression (col = :bind)
  function evalExpr(expr: string): boolean {
    log.debug("evalExpr", { expr, row, normRow, bindArgs, normBindArgs });
    // Support quoted identifiers and SQL keywords as column names
    // If quoted, allow spaces; if unquoted, do not allow spaces
    const m = expr.match(/([`"\[])?([a-zA-Z0-9_$ ]+)\1?\s*=\s*:(\w+)/);
    if (!m) {
      log.debug("evalExpr: no match", { expr });
      return false;
    }
    const [ , quote, colRaw, bind ] = m;
    const col = colRaw.trim();
    const normBind = bind.toLowerCase();
    let rowVal;
    if (quote) {
      // Quoted: match exact key (case-sensitive)
      rowVal = row[col];
      if (typeof rowVal === 'undefined') {
        // Fallback to lowercased key if not found
        rowVal = normRow[col.toLowerCase()];
      }
    } else {
      // Unquoted: match lowercased key (case-insensitive)
      rowVal = normRow[col.toLowerCase()];
      if (typeof rowVal === 'undefined' && col in row) rowVal = row[col];
      if (typeof rowVal === 'undefined') {
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase() === col.toLowerCase()) {
            rowVal = v;
            break;
          }
        }
      }
    }
    log.debug("evalExpr: keys", {
      col, bind, normBind,
      rowKeys: Object.keys(row),
      normRowKeys: Object.keys(normRow),
      bindArgKeys: Object.keys(bindArgs),
      normBindArgKeys: Object.keys(normBindArgs),
      normBindArgs
    });
    if (!(normBind in normBindArgs)) {
      log.debug("evalExpr: missing bind arg", { bind, normBind, normBindArgs });
      throw new Error(`Missing bind argument: ${bind}`);
    }
    const bindVal = normBindArgs[normBind];
    log.debug("evalExpr: compare", { col, rowVal, bind, normBind, bindVal });
    if ((rowVal === null || typeof rowVal === 'undefined') && (bindVal === null || typeof bindVal === 'undefined')) return true;
    // Use loose equality for D1-like behavior (string/number comparison)
    // eslint-disable-next-line eqeqeq
    return rowVal == bindVal;
  }

  // Recursively evaluate the condition with correct operator precedence (AND binds tighter than OR)
  function evalCond(cond: string): boolean {
    cond = cond.trim();
    log.debug("evalCond: entry", { cond });
    // Remove outer parenthesis if they wrap the whole condition
    while (cond.startsWith('(') && cond.endsWith(')')) {
      let depth = 0;
      let wraps = true;
      for (let i = 0; i < cond.length; i++) {
        if (cond[i] === '(') depth++;
        if (cond[i] === ')') depth--;
        if (depth === 0 && i < cond.length - 1) {
          wraps = false;
          break;
        }
      }
      if (wraps) {
        cond = cond.slice(1, -1).trim();
      } else {
        break;
      }
    }
    // Helper to check word boundary
    function isWordBoundary(str: string, idx: number): boolean {
      if (idx < 0 || idx >= str.length) return true;
      return !/\w/.test(str[idx]);
    }
    // Split on OR at the top level (lowest precedence)
    let orParts: string[] = [];
    let depth = 0, last = 0;
    for (let i = 0; i <= cond.length - 2; i++) {
      if (cond[i] === '(') depth++;
      if (cond[i] === ')') depth--;
      if (
        depth === 0 &&
        cond.slice(i, i + 2).toUpperCase() === 'OR' &&
        isWordBoundary(cond, i - 1) &&
        isWordBoundary(cond, i + 2)
      ) {
        orParts.push(cond.slice(last, i).trim());
        last = i + 2;
        i += 1;
      }
    }
    if (orParts.length) {
      orParts.push(cond.slice(last).trim());
      log.debug("evalCond: OR split", { cond, orParts });
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
        isWordBoundary(cond, i - 1) &&
        isWordBoundary(cond, i + 3)
      ) {
        andParts.push(cond.slice(last, i).trim());
        last = i + 3;
        i += 2;
      }
    }
    if (andParts.length) {
      andParts.push(cond.slice(last).trim());
      log.debug("evalCond: AND split", { cond, andParts });
      return andParts.every(part => evalCond(part));
    }
    // Base case: single expression
    log.debug("evalCond: base case", { cond });
    return evalExpr(cond);
  }

  log.debug("entry", { row, cond, bindArgs });
  const result = evalCond(cond);
  log.debug("result", { row, cond, bindArgs, result });
  return result;
}