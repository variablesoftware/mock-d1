export const RESERVED = ["like", "between", "join", "select", "from", "where", "and", "or"];

export function randomAlpha(len = 6) {
  return Array.from({ length: len }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join("");
}

export function randomSnake(len = 2) {
  let name;
  do {
    name = Array.from({ length: len }, () => randomAlpha(4)).join("_");
  } while (RESERVED.includes(name.toLowerCase()));
  return name;
}

/**
 * Returns a random integer between min (inclusive) and max (exclusive).
 * @param min - Minimum integer value (inclusive)
 * @param max - Maximum integer value (exclusive)
 */
export function randomInt(min = 0, max = 1000): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

export function randomData(keys: string[]) {
  const row: Record<string, string | number> = {};
  for (const key of keys) {
    row[key] =
      Math.random() < 0.5 ? randomAlpha(5) : Math.floor(Math.random() * 1000);
  }
  return row;
}