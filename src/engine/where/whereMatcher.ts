import { D1Row } from "../../types/MockD1Database";
import { log } from "@variablesoftware/logface";
import { parseWhereClause, matchesWhereImpl } from './whereMatcherImpl.js';

/**
 * Orchestrates WHERE clause evaluation for D1 mock engine.
 * @param whereClause - The WHERE clause string.
 * @param row - The row to evaluate.
 * @param bindArgs - The bind arguments.
 * @returns True if the row matches, false otherwise.
 */
export function evaluateWhereClause(whereClause: string, row: Record<string, unknown>, bindArgs: Record<string, unknown>): boolean {
  const predicate = parseWhereClause(whereClause);
  return matchesWhereImpl(predicate, row, bindArgs);
}