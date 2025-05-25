import { describe, it, expect, beforeEach } from 'vitest';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert.js';
import { randomSnake, randomInt, randomAlpha, randomData } from '../helpers/index.js';

function makeTable(columns, rows) {
  return {
    columns: columns.map(c => ({ name: c, quoted: false })),
    rows: rows.map(r => ({ ...r })),
  };
}

describe('handleInsert', () => {
  let db;
  let tableName;
  let colA, colB;

  beforeEach(() => {
    db = new Map();
    tableName = randomSnake();
    colA = randomSnake();
    colB = randomSnake();
    db.set(tableName, makeTable([colA, colB], [
      { [colA]: 1, [colB]: 'foo' },
      { [colA]: 2, [colB]: 'bar' },
    ]));
  });

  it('inserts a row with bind values', () => {
    const sql = `INSERT INTO ${tableName} (${colA}, ${colB}) VALUES (:a, :b)`;
    const result = handleInsert(sql, db, { a: 3, b: 'baz' });
    expect(result.success).toBe(true);
    const rows = db.get(tableName).rows;
    expect(rows[rows.length - 1][colA]).toBe(3);
    expect(rows[rows.length - 1][colB]).toBe('baz');
  });

  it('auto-creates table if not exists', () => {
    const newTable = randomSnake();
    const sql = `INSERT INTO ${newTable} (foo, bar) VALUES (:foo, :bar)`;
    const result = handleInsert(sql, db, { foo: 1, bar: 'baz' });
    expect(result.success).toBe(true);
    expect(db.has(newTable.toLowerCase()) || db.has(newTable)).toBe(true);
  });

  it('throws if column/value count mismatch', () => {
    const sql = `INSERT INTO ${tableName} (${colA}) VALUES (:a, :b)`;
    expect(() => handleInsert(sql, db, { a: 1, b: 2 })).toThrow();
  });

  it('throws if missing bind argument', () => {
    const sql = `INSERT INTO ${tableName} (${colA}, ${colB}) VALUES (:a, :b)`;
    expect(() => handleInsert(sql, db, { a: 1 })).toThrow();
  });

  it('throws on non-bind value in VALUES', () => {
    const sql = `INSERT INTO ${tableName} (${colA}, ${colB}) VALUES (1, :b)`;
    expect(() => handleInsert(sql, db, { b: 2 })).toThrow();
  });

  it('throws on duplicate column names', () => {
    const sql = `INSERT INTO ${tableName} (${colA}, ${colA}) VALUES (:a, :b)`;
    expect(() => handleInsert(sql, db, { a: 1, b: 2 })).toThrow();
  });

  it('inserts with quoted identifiers', () => {
    const quotedCol = `"${colB}"`;
    const sql = `INSERT INTO ${tableName} (${colA}, ${quotedCol}) VALUES (:a, :b)`;
    const result = handleInsert(sql, db, { a: 4, b: 'quux' });
    expect(result.success).toBe(true);
    const rows = db.get(tableName).rows;
    expect(rows[rows.length - 1][colB]).toBe('quux');
  });

  it('inserts object/array values as JSON', () => {
    const sql = `INSERT INTO ${tableName} (${colA}, ${colB}) VALUES (:a, :b)`;
    handleInsert(sql, db, { a: 5, b: { foo: 1 } });
    const rows = db.get(tableName).rows;
    expect(rows[rows.length - 1][colB]).toBe(JSON.stringify({ foo: 1 }));
    handleInsert(sql, db, { a: 6, b: [1, 2, 3] });
    expect(rows[rows.length - 1][colB]).toBe(JSON.stringify([1, 2, 3]));
  });

  it('skips insert if all values are undefined', () => {
    const sql = `INSERT INTO ${tableName} (${colA}, ${colB}) VALUES (:a, :b)`;
    const result = handleInsert(sql, db, { a: undefined, b: undefined });
    expect(result.success).toBe(false);
  });

  it('throws on unsupported data types', () => {
    const sql = `INSERT INTO ${tableName} (${colA}, ${colB}) VALUES (:a, :b)`;
    expect(() => handleInsert(sql, db, { a: 1, b: () => {} })).toThrow();
    expect(() => handleInsert(sql, db, { a: 1, b: Symbol('x') })).toThrow();
    expect(() => handleInsert(sql, db, { a: 1, b: BigInt(1) })).toThrow();
  });
});
