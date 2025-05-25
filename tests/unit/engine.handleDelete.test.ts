import { describe, it, expect, beforeEach } from 'vitest';
import { handleDelete } from '../../src/engine/statementHandlers/handleDelete.js';
import { randomSnake, randomInt, randomAlpha, randomData } from '../helpers/index.js';

function makeTable(columns, rows) {
  return {
    columns: columns.map(c => ({ name: c, quoted: false })),
    rows: rows.map(r => ({ ...r })),
  };
}

describe('handleDelete', () => {
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

  it('deletes all rows if no WHERE', () => {
    const sql = `DELETE FROM ${tableName}`;
    const result = handleDelete(sql, db, {});
    expect(result.success).toBe(true);
    expect(db.get(tableName).rows.length).toBe(0);
    expect(result.changes).toBe(2);
  });

  it('deletes only matching rows with WHERE', () => {
    const sql = `DELETE FROM ${tableName} WHERE ${colA} = :id`;
    const result = handleDelete(sql, db, { id: 1 });
    expect(result.success).toBe(true);
    const rows = db.get(tableName).rows;
    expect(rows.length).toBe(1);
    expect(rows[0][colA]).toBe(2);
    expect(result.changes).toBe(1);
  });

  it('throws if table does not exist', () => {
    const sql = `DELETE FROM not_a_table`;
    expect(() => handleDelete(sql, db, {})).toThrow();
  });

  it('throws if missing bind argument', () => {
    const sql = `DELETE FROM ${tableName} WHERE ${colA} = :id`;
    expect(() => handleDelete(sql, db, {})).toThrow();
  });

  it('throws on malformed SQL', () => {
    expect(() => handleDelete('DELETE', db, {})).toThrow();
    expect(() => handleDelete('DELETE FROM', db, {})).toThrow();
  });
});
