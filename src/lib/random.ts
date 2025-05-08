/**
 * @file src/lib/random.ts
 * @description Random data generation utilities for tests and fuzzing.
 */

/**
 * Reserved SQL keywords to avoid for table/column names.
 */
export const RESERVED = [
  "like", "between", "join", "select", "from", "where", "and", "or"
];

/**
 * Generates a random lowercase alphabetic string.
 * @param len - Length of the string.
 * @param failRate - Optional probability (0-1) to throw an error for fuzzing.
 * @returns A random string.
 * @throws If randomly chosen to fail (for fuzzing).
 */
export function randomAlpha(len = 6, failRate = 0): string {
  if (failRate > 0 && Math.random() < failRate) throw new Error("randomAlpha failed!");
  return Array.from({ length: len }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join("");
}

/**
 * Generates a snake_case name, avoiding reserved SQL keywords.
 * @param len - Number of segments.
 * @param failRate - Optional probability (0-1) to throw an error for fuzzing.
 * @returns A random snake_case string.
 * @throws If randomly chosen to fail (for fuzzing).
 */
export function randomSnake(len = 2, failRate = 0): string {
  let name;
  do {
    if (failRate > 0 && Math.random() < failRate) throw new Error("randomSnake failed!");
    name = Array.from({ length: len }, () => randomAlpha(4, failRate)).join("_");
  } while (RESERVED.includes(name.toLowerCase()));
  return name;
}

/**
 * Generates a random row object for the given keys.
 * @param keys - Array of column names.
 * @param failRate - Optional probability (0-1) to throw an error for fuzzing.
 * @returns An object mapping keys to random values.
 * @throws If randomly chosen to fail (for fuzzing).
 */
export function randomData(keys: string[], failRate = 0): Record<string, string | number> {
  if (failRate > 0 && Math.random() < failRate) throw new Error("randomData failed!");
  const row: Record<string, string | number> = {};
  for (const key of keys) {
    row[key] =
      Math.random() < 0.5 ? randomAlpha(5, failRate) : Math.floor(Math.random() * 1000);
  }
  return row;
}
