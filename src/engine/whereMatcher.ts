import { D1Row } from "../types/MockD1Database";

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
  return cond.split(/\s+or\s+/i).some(orGroup =>
    orGroup.split(/\s+and\s+/i).every(expr => {
      const m = expr.match(/([a-zA-Z0-9_]+)\s*=\s*:(\w+)/);
      if (!m) return false;
      const [, col, bind] = m;
      if (!(bind in bindArgs)) throw new Error(`Missing bind argument: ${bind}`);
      return row[col] === bindArgs[bind];
    })
  );
}