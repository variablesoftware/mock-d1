/**
 * @file engine/whereMatcher/whereMatcherImpl.ts
 * @description Implementation for WHERE clause parsing and matching logic (D1-compatible).
 * This file should contain only pure functions and logic for evaluating WHERE clauses.
 */

import { D1Row } from '../../types/MockD1Database.js';
import { parseWhereClause as parseWhereAst, WhereAstNode } from './whereParser.js';

function evalWhereAst(ast: WhereAstNode, row: D1Row, bindArgs: Record<string, unknown>, depth = 0): boolean {
  if (depth > 20) {
    throw new Error('WHERE clause is too deeply nested or complex for the mock D1 engine.');
  }
  switch (ast.type) {
    case 'and':
      return evalWhereAst(ast.left, row, bindArgs, depth + 1) && evalWhereAst(ast.right, row, bindArgs, depth + 1);
    case 'or':
      return evalWhereAst(ast.left, row, bindArgs, depth + 1) || evalWhereAst(ast.right, row, bindArgs, depth + 1);
    case 'comparison': {
      // Normalize column name (case-insensitive for unquoted, case-sensitive for quoted)
      let col = ast.column;
      let quoted = /^([`"\[]).+\1$/.test(col);
      let rowVal: unknown;
      if (quoted) {
        col = col.slice(1, -1);
        rowVal = row[col];
      } else {
        // Try lower-case, fallback to case-insensitive match
        rowVal = row[col.toLowerCase()];
        if (typeof rowVal === 'undefined') {
          for (const k of Object.keys(row)) {
            if (k.toLowerCase() === col.toLowerCase()) {
              rowVal = row[k];
              break;
            }
          }
        }
      }
      let val = ast.value;
      if (typeof val === 'string' && val.startsWith(':')) {
        // Bind parameter
        const bindKey = val.slice(1);
        if (!(bindKey in bindArgs)) throw new Error(`Missing bind argument: ${bindKey}`);
        val = bindArgs[bindKey];
      } else if (typeof val === 'string' && ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"')))) {
        val = val.slice(1, -1);
      } else if (typeof val === 'string' && /^\d+$/.test(val)) {
        val = Number(val);
      }
      // Null/undefined equivalence
      if ((rowVal === null || typeof rowVal === 'undefined') && (val === null || typeof val === 'undefined')) return true;
      return rowVal == val;
    }
    case 'isNull': {
      let col = ast.column;
      let quoted = /^([`"\[]).+\1$/.test(col);
      let rowVal: unknown;
      if (quoted) {
        col = col.slice(1, -1);
        rowVal = row[col];
      } else {
        rowVal = row[col.toLowerCase()];
        if (typeof rowVal === 'undefined') {
          for (const k of Object.keys(row)) {
            if (k.toLowerCase() === col.toLowerCase()) {
              rowVal = row[k];
              break;
            }
          }
        }
      }
      const isNull = rowVal === null || typeof rowVal === 'undefined';
      return ast.not ? !isNull : isNull;
    }
    default:
      throw new Error('Unsupported WHERE clause AST node.');
  }
  // Unreachable, but required for type safety
  throw new Error('Unreachable code in evalWhereAst');
}

export function parseWhereClause(whereClause: string): (row: D1Row, bindArgs: Record<string, unknown>) => boolean {
  let ast: WhereAstNode;
  try {
    ast = parseWhereAst(whereClause);
  } catch (err: any) {
    // Propagate D1 error or wrap
    throw err;
  }
  return (row: D1Row, bindArgs: Record<string, unknown>) => evalWhereAst(ast, row, bindArgs);
}

export function matchesWhereImpl(predicate: (row: D1Row, bindArgs: Record<string, unknown>) => boolean, row: D1Row, bindArgs: Record<string, unknown>): boolean {
  return predicate(row, bindArgs);
}
