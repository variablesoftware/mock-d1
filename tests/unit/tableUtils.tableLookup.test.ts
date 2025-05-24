import { describe, it, expect } from 'vitest';
import { findTableKey, findColumnKey } from '../../src/engine/tableUtils/tableLookup.js';
import { randomSnake } from '../helpers/index.js';

describe('tableLookup', () => {
  it('finds table key case-insensitively', () => {
    const t1 = randomSnake();
    const t2 = randomSnake();
    const t3 = '"' + randomSnake() + '"';
    const db = new Map([
      [t1, {}],
      [t2.toUpperCase(), {}],
      [t3, {}],
    ]);
    expect(findTableKey(db, t1)).toBe(t1);
    expect(findTableKey(db, t1.toUpperCase())).toBe(t1);
    expect(findTableKey(db, t2)).toBe(t2.toUpperCase());
    // For quoted table names, only the exact quoted name matches
    expect(findTableKey(db, t3.replace(/"/g, ''))).toBeUndefined();
    expect(findTableKey(db, t3)).toBe(t3);
    expect(findTableKey(db, randomSnake())).toBeUndefined();
  });

  it('finds column key with quoted/unquoted logic', () => {
    const col1 = randomSnake();
    const col2 = randomSnake();
    const col3 = randomSnake();
    const columns = [
      { name: col1, quoted: false },
      { name: col2, quoted: true },
      { name: col3, quoted: false },
    ];
    expect(findColumnKey(columns, col1)).toBe(col1);
    expect(findColumnKey(columns, col1.toUpperCase())).toBe(col1);
    expect(findColumnKey(columns, col2)).toBe(col2);
    expect(findColumnKey(columns, col2.toLowerCase())).toBe(col2);
    expect(findColumnKey(columns, col3)).toBe(col3);
    expect(findColumnKey(columns, col3.toUpperCase())).toBe(col3);
    expect(findColumnKey(columns, randomSnake())).toBeUndefined();
  });
});
