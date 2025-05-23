// filepath: src/engine/where/whereEvaluator.ts
/**
 * @file engine/where/whereEvaluator.ts
 * @description Evaluates a WHERE clause AST node against a row and bind arguments.
 */
import { WhereAstNode } from './whereParser.js';

export function evaluateWhereAst(
  ast: WhereAstNode,
  row: Record<string, unknown>,
  bindArgs: Record<string, unknown>
): boolean {
  switch (ast.type) {
    case 'and':
      return evaluateWhereAst(ast.left, row, bindArgs) && evaluateWhereAst(ast.right, row, bindArgs);
    case 'or':
      return evaluateWhereAst(ast.left, row, bindArgs) || evaluateWhereAst(ast.right, row, bindArgs);
    case 'isNull': {
      const colVal = row[ast.column] ?? row[ast.column.toLowerCase()];
      const isNull = colVal === null || typeof colVal === 'undefined';
      return ast.not ? !isNull : isNull;
    }
    case 'comparison': {
      let colVal = row[ast.column] ?? row[ast.column.toLowerCase()];
      let rhs = ast.value;
      if (typeof rhs === 'string' && rhs.startsWith(':')) {
        // Bind parameter
        const bindKey = rhs.slice(1);
        rhs = bindArgs[bindKey] ?? bindArgs[bindKey.toLowerCase()];
      } else if (typeof rhs === 'string' && /^['"].*['"]$/.test(rhs)) {
        rhs = rhs.slice(1, -1);
      } else if (typeof rhs === 'string' && /^\d+$/.test(rhs)) {
        rhs = Number(rhs);
      }
      // D1: null/undefined are equivalent
      if ((colVal === null || typeof colVal === 'undefined') && (rhs === null || typeof rhs === 'undefined')) return true;
      return colVal === rhs;
    }
    default:
      throw new Error('Unknown AST node type');
  }
}
