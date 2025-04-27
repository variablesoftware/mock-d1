export function randomAlpha(len = 6) {
  return Array.from({ length: len }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join("");
}

export function randomSnake(len = 2) {
  return Array.from({ length: len }, () => randomAlpha(4)).join("_");
}

export function randomData(keys: string[]) {
  const row: Record<string, string | number> = {};
  for (const key of keys) {
    row[key] =
      Math.random() < 0.5 ? randomAlpha(5) : Math.floor(Math.random() * 1000);
  }
  return row;
}
