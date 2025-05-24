import { describe, it, expect } from 'vitest';
import { mockInject } from '../../../src/helpers/mockInject.js';
import { randomSnake, randomInt } from '../../helpers/index.js';

describe('mockInject', () => {
  it('injects a table into the db', () => {
    const db = new Map();
    const tableName = randomSnake();
    const colA = randomSnake();
    const colB = randomSnake();
    const columns = [
      { original: colA, name: colA, quoted: false },
      { original: colB, name: colB, quoted: false }
    ];
    const row1 = { [colA]: randomInt(), [colB]: randomSnake() };
    const row2 = { [colA]: randomInt(), [colB]: randomSnake() };
    mockInject(db, tableName, columns, [row1, row2]);
    expect(db.has(tableName)).toBe(true);
    const table = db.get(tableName);
    expect(table?.rows.length).toBe(2);
    expect(table?.rows[0][colB]).toBe(row1[colB]);
  });

  it('throws if table name is missing', () => {
    const db = new Map();
    const columns = [ { original: 'id', name: 'id', quoted: false } ];
    expect(() => mockInject(db, '', columns, [{ id: 1 }])).toThrow();
  });

  it('throws if rows is not an array', () => {
    const db = new Map();
    const columns = [ { original: 'foo', name: 'foo', quoted: false } ];
    expect(() => mockInject(db, 'foo', columns, null as any)).toThrow();
    expect(() => mockInject(db, 'foo', columns, {} as any)).toThrow();
  });
});
