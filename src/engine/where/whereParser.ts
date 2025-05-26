// filepath: src/engine/where/whereParser.ts
/**
 * @file engine/where/whereParser.ts
 * @description Parses a SQL WHERE clause string into an AST for evaluation.
 */

import { d1Error } from '../errors.js';

export type WhereAstNode =
  | { type: 'and', left: WhereAstNode, right: WhereAstNode }
  | { type: 'or', left: WhereAstNode, right: WhereAstNode }
  | { type: 'comparison', column: string, operator: string, value: unknown }
  | { type: 'isNull', column: string, not: boolean };

const UNSUPPORTED_OPERATORS = [
  'IN', 'NOT IN', 'BETWEEN', 'LIKE', 'GLOB', 'REGEXP', 'ANY', 'ALL', 'SOME', 'EXISTS', 'IS DISTINCT FROM', 'ESCAPE'
];

/**
 * Parses a WHERE clause string into an AST. (Stub: supports only simple equality and IS [NOT] NULL)
 * Throws a D1-like error for unsupported operators.
 * @param where - The WHERE clause string.
 * @returns WhereAstNode
 */
export function parseWhereClause(where: string, depth = 0): WhereAstNode {
  // Only increment depth for actual parenthesis nesting
  let trimmed = where.trim();
  while (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    if (depth > 20) {
      throw new Error('WHERE clause is too deeply nested or complex for the mock D1 engine.');
    }
    let paren = 0;
    let wraps = true;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '(') paren++;
      if (trimmed[i] === ')') paren--;
      if (paren === 0 && i < trimmed.length - 1) {
        wraps = false;
        break;
      }
    }
    if (wraps) {
      trimmed = trimmed.slice(1, -1).trim();
      depth++;
    } else {
      break;
    }
  }
  // Defensive: throw on empty or incomplete WHERE clause
  if (!trimmed || /^\s*(AND|OR)?\s*$/i.test(trimmed)) {
    throw d1Error('UNSUPPORTED_SQL', 'Malformed or incomplete WHERE clause');
  }
  for (const op of UNSUPPORTED_OPERATORS) {
    const regex = new RegExp(`\\b${op.replace(/ /g, '\\s+')}\\b`, 'i');
    if (regex.test(trimmed)) {
      throw d1Error('UNSUPPORTED_SQL', `Operator '${op}' is not supported by D1.`);
    }
  }
  const andIdx = trimmed.toUpperCase().indexOf(' AND ');
  if (andIdx !== -1) {
    // Defensive: both sides must be non-empty
    const left = trimmed.slice(0, andIdx).trim();
    const right = trimmed.slice(andIdx + 5).trim();
    if (!left || !right) {
      throw d1Error('UNSUPPORTED_SQL', 'Malformed WHERE clause: empty or incomplete condition');
    }
    return {
      type: 'and',
      left: parseWhereClause(left, depth),
      right: parseWhereClause(right, depth),
    };
  }
  const orIdx = trimmed.toUpperCase().indexOf(' OR ');
  if (orIdx !== -1) {
    // Defensive: both sides must be non-empty
    const left = trimmed.slice(0, orIdx).trim();
    const right = trimmed.slice(orIdx + 4).trim();
    if (!left || !right) {
      throw d1Error('UNSUPPORTED_SQL', 'Malformed WHERE clause: empty or incomplete condition');
    }
    return {
      type: 'or',
      left: parseWhereClause(left, depth),
      right: parseWhereClause(right, depth),
    };
  }
  // Defensive: catch WHERE clauses ending with an operator (e.g., 'a = 1 OR')
  if (/\b(AND|OR)\s*$/i.test(trimmed)) {
    throw d1Error('UNSUPPORTED_SQL', 'Malformed WHERE clause: ends with operator');
  }
  // Accept unquoted/quoted column names and numbers/strings/binds as values
  // Accepts: foo = 1, "foo" = 'bar', [foo] = :bind, etc.
  const eq = trimmed.match(/^([`"[]?\w+[`"\]]?)\s*=\s*(:(\w+)|'(.*?)'|"(.*?)"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/i);
  if (eq) {
    let value: unknown = eq[2];
    if (eq[3]) value = ':' + eq[3]; // bind
    else if (eq[4] !== undefined) value = eq[4]; // single-quoted string
    else if (eq[5] !== undefined) value = eq[5]; // double-quoted string
    return {
      type: 'comparison',
      column: eq[1],
      operator: '=',
      value,
    };
  }
  const isNull = trimmed.match(/^([`"[]?\w+[`"\]]?)\s+IS\s+(NOT\s+)?NULL$/i);
  if (isNull) {
    return {
      type: 'isNull',
      column: isNull[1],
      not: Boolean(isNull[2]),
    };
  }
  throw d1Error('UNSUPPORTED_SQL', `Malformed or unsupported WHERE clause: ${where}`);
}
