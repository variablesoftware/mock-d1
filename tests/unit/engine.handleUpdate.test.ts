import { describe, it, expect, beforeEach } from 'vitest';
import { handleUpdate } from '../../src/engine/statementHandlers/handleUpdate.js';
import { randomSnake, randomInt, randomAlpha, randomData } from '../helpers/index.js';

function makeTable(columns: string[], rows: Record<string, unknown>[]) {
  return {
    columns: Object.fromEntries(columns.map(c => [c, { name: c, quoted: false }])),
    rows: rows.map(r => ({ ...r })),
  };
}

describe('handleUpdate', () => {
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

  it('updates rows matching WHERE', () => {
    const sql = `UPDATE ${tableName} SET ${colB} = :val WHERE ${colA} = :id`;
    const result = handleUpdate(sql, db, { val: 'baz', id: 1 });
    expect(result.success).toBe(true);
    const rows = db.get(tableName).rows;
    expect(rows[0][colB]).toBe('baz');
    expect(rows[1][colB]).toBe('bar');
  });

  it('updates all rows if no WHERE', () => {
    const sql = `UPDATE ${tableName} SET ${colB} = :val`;
    const result = handleUpdate(sql, db, { val: 'baz' });
    expect(result.success).toBe(true);
    const rows = db.get(tableName).rows;
    expect(rows[0][colB]).toBe('baz');
    expect(rows[1][colB]).toBe('baz');
  });

  it('throws if column does not exist', () => {
    const sql = `UPDATE ${tableName} SET notacol = :val`;
    expect(() => handleUpdate(sql, db, { val: 1 })).toThrow();
  });

  it('throws if missing bind argument', () => {
    const sql = `UPDATE ${tableName} SET ${colB} = :val WHERE ${colA} = :id`;
    expect(() => handleUpdate(sql, db, { val: 'baz' })).toThrow();
    expect(() => handleUpdate(sql, db, { id: 1 })).toThrow();
  });

  it('updates with quoted identifiers', () => {
    const quotedCol = `"${colB}"`;
    const sql = `UPDATE ${tableName} SET ${quotedCol} = :val WHERE ${colA} = :id`;
    const result = handleUpdate(sql, db, { val: 'baz', id: 1 });
    expect(result.success).toBe(true);
    expect(db.get(tableName).rows[0][colB]).toBe('baz');
  });

  it('updates with object/array values (stringified)', () => {
    const sql = `UPDATE ${tableName} SET ${colB} = :val`;
    handleUpdate(sql, db, { val: { foo: 1 } });
    expect(db.get(tableName).rows[0][colB]).toBe(JSON.stringify({ foo: 1 }));
    handleUpdate(sql, db, { val: [1, 2, 3] });
    expect(db.get(tableName).rows[0][colB]).toBe(JSON.stringify([1, 2, 3]));
  });

  it('returns correct meta info', () => {
    const sql = `UPDATE ${tableName} SET ${colB} = :val`;
    const result = handleUpdate(sql, db, { val: 'baz' });
    expect(result.meta.changes).toBe(2);
    expect(result.meta.rows_read).toBe(2);
    expect(result.meta.rows_written).toBe(2);
    expect(result.meta.changed_db).toBe(true);
  });
});
