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
    if (!expr || expr.match(/^(AND|OR)$/i)) {
      throw new Error("Malformed WHERE clause: empty or incomplete expression: '" + expr + "'");
    }
    // Support: col = :bind, col = <literal>, col IS NULL, col IS NOT NULL
    // 1. col = :bind
    let m = expr.match(/([`"[])?([a-zA-Z0-9_$ ]+)\1?\s*=\s*:(\w+)/);
    if (m) {
      const [, quote, colRaw, bind] = m;
      const col = colRaw.trim();
      const normBind = bind.toLowerCase();
      let rowVal;
      if (quote) {
        rowVal = row[col];
        if (typeof rowVal === 'undefined') rowVal = normRow[col.toLowerCase()];
      } else {
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
      if (!(normBind in normBindArgs)) {
        throw new Error(`Missing bind argument: ${bind}`);
      }
      const bindVal = normBindArgs[normBind];
      if (Array.isArray(bindVal) || (typeof bindVal === 'object' && bindVal !== null)) {
        throw new Error(`Bind argument '${bind}' must not be array or object`);
      }
      if ((rowVal === null || typeof rowVal === 'undefined') && (bindVal === null || typeof bindVal === 'undefined')) return true;
      return rowVal == bindVal;
    }
    // 2. col = <literal> (string, number, boolean, null)
    m = expr.match(/([`"[])?([a-zA-Z0-9_$ ]+)\1?\s*=\s*(.+)/);
    if (m) {
      const [, quote, colRaw, litRaw] = m;
      const col = colRaw.trim();
      let rowVal;
      if (quote) {
        rowVal = row[col];
        if (typeof rowVal === 'undefined') rowVal = normRow[col.toLowerCase()];
      } else {
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
      let lit: string | number | boolean | null = litRaw.trim();
      // Parse literal: quoted string, number, boolean, null
      if ((lit.startsWith("'") && lit.endsWith("'")) || (lit.startsWith('"') && lit.endsWith('"'))) {
        lit = lit.slice(1, -1);
        // SQL escaping: replace doubled single quotes with single quote
        if (litRaw.startsWith("'")) {
          lit = (lit as string).replace(/''/g, "'");
        }
      } else if (/^(true|false)$/i.test(lit)) {
        lit = lit.toLowerCase() === 'true';
      } else if (/^null$/i.test(lit)) {
        lit = null;
      } else if (!isNaN(Number(lit))) {
        lit = Number(lit);
      }
      if ((rowVal === null || typeof rowVal === 'undefined') && (lit === null || typeof lit === 'undefined')) return true;
      return rowVal == lit;
    }
    // 3. col IS NULL / col IS NOT NULL
    m = expr.match(/([`"[])?([a-zA-Z0-9_$ ]+)\1?\s+IS(\s+NOT)?\s+NULL/i);
    if (m) {
      const [, quote, colRaw, not] = m;
      const col = colRaw.trim();
      let rowVal;
      if (quote) {
        rowVal = row[col];
        if (typeof rowVal === 'undefined') rowVal = normRow[col.toLowerCase()];
      } else {
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
      const isNull = rowVal === null || typeof rowVal === 'undefined';
      return not ? !isNull : isNull;
    }
    // If the expression is not empty but doesn't match the supported pattern, treat as unsupported (return false)
    return false;
  }

  // Recursively evaluate the condition with correct operator precedence (AND binds tighter than OR)
  function evalCond(cond: string): boolean {
    cond = cond.trim();
    log.debug("evalCond: entry", { cond });
    // Parentheses balance check
    let paren = 0;
    for (let i = 0; i < cond.length; i++) {
      if (cond[i] === '(') paren++;
      if (cond[i] === ')') paren--;
      if (paren < 0) throw new Error("Malformed WHERE clause: unbalanced parentheses");
    }
    if (paren !== 0) throw new Error("Malformed WHERE clause: unbalanced parentheses");
    // Reject empty or obviously malformed conditions
    if (!cond || cond.match(/^(AND|OR)$/i)) {
      throw new Error("Malformed WHERE clause: empty or incomplete condition");
    }
    // Additional check: if cond is only whitespace, throw
    if (cond.length === 0) {
      throw new Error("Malformed WHERE clause: empty or incomplete condition");
    }
  
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
        const part = cond.slice(last, i).trim();
        if (!part) throw new Error("Malformed WHERE clause: incomplete OR condition");
        orParts.push(part);
        last = i + 2;
        i += 1;
      }
    }
    if (orParts.length) {
      const part = cond.slice(last).trim();
      if (!part) throw new Error("Malformed WHERE clause: incomplete OR condition");
      orParts.push(part);
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
        const part = cond.slice(last, i).trim();
        if (!part) throw new Error("Malformed WHERE clause: incomplete AND condition");
        andParts.push(part);
        last = i + 3;
        i += 2;
      }
    }
    if (andParts.length) {
      const part = cond.slice(last).trim();
      if (!part) throw new Error("Malformed WHERE clause: incomplete AND condition");
      andParts.push(part);
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