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
  // ...existing code, but do not increment depth for AND/OR splits...
  for (const op of UNSUPPORTED_OPERATORS) {
    const regex = new RegExp(`\\b${op.replace(/ /g, '\\s+')}\\b`, 'i');
    if (regex.test(trimmed)) {
      throw d1Error('UNSUPPORTED_SQL', `Operator '${op}' is not supported by D1.`);
    }
  }
  const andIdx = trimmed.toUpperCase().indexOf(' AND ');
  if (andIdx !== -1) {
    return {
      type: 'and',
      left: parseWhereClause(trimmed.slice(0, andIdx), depth),
      right: parseWhereClause(trimmed.slice(andIdx + 5), depth),
    };
  }
  const orIdx = trimmed.toUpperCase().indexOf(' OR ');
  if (orIdx !== -1) {
    return {
      type: 'or',
      left: parseWhereClause(trimmed.slice(0, orIdx), depth),
      right: parseWhereClause(trimmed.slice(orIdx + 4), depth),
    };
  }
  const isNull = trimmed.match(/^([`"\[]?\w+[`"\]]?)\s+IS\s+(NOT\s+)?NULL$/i);
  if (isNull) {
    return {
      type: 'isNull',
      column: isNull[1],
      not: Boolean(isNull[2]),
    };
  }
  const eq = trimmed.match(/^([`"\[]?\w+[`"\]]?)\s*=\s*(:\w+|'.*?'|".*?"|\d+)$/);
  if (eq) {
    return {
      type: 'comparison',
      column: eq[1],
      operator: '=',
      value: eq[2],
    };
  }
  throw d1Error('UNSUPPORTED_SQL', `Malformed or unsupported WHERE clause: ${where}`);
}
