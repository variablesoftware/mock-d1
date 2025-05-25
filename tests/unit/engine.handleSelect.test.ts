import { describe, it, expect, beforeEach } from 'vitest';
import { handleSelect } from '../../src/engine/statementHandlers/handleSelect.js';
import { randomSnake, randomInt, randomAlpha, randomData } from '../helpers/index.js';

function makeTable(columns, rows) {
  return {
    columns: columns.map(c => ({ name: c, quoted: false })),
    rows: rows.map(r => ({ ...r })),
  };
}

describe('handleSelect', () => {
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

  it('selects all rows with SELECT *', () => {
    const sql = `SELECT * FROM ${tableName}`;
    const result = handleSelect(sql, db, {}, 'all');
    expect(result.success).toBe(true);
    expect(result.results.length).toBe(2);
  });

  it('selects first row with mode "first"', () => {
    const sql = `SELECT * FROM ${tableName}`;
    const result = handleSelect(sql, db, {}, 'first');
    expect(result.success).toBe(true);
    expect(result.results.length).toBe(1);
  });

  it('selects specific columns', () => {
    const sql = `SELECT ${colA} FROM ${tableName}`;
    const result = handleSelect(sql, db, {}, 'all');
    expect(result.success).toBe(true);
    expect(result.results[0][colA]).toBe(1);
    expect(result.results[0][colB]).toBeUndefined();
  });

  it('filters rows with WHERE', () => {
    const sql = `SELECT * FROM ${tableName} WHERE ${colA} = :id`;
    const result = handleSelect(sql, db, { id: 2 }, 'all');
    expect(result.success).toBe(true);
    expect(result.results.length).toBe(1);
    expect(result.results[0][colA]).toBe(2);
  });

  it('returns COUNT(*)', () => {
    const sql = `SELECT COUNT(*) FROM ${tableName}`;
    const result = handleSelect(sql, db, {}, 'all');
    expect(result.success).toBe(true);
    expect(result.results[0]["COUNT(*)"]).toBe(2);
  });

  it('throws if table does not exist', () => {
    const sql = `SELECT * FROM not_a_table`;
    expect(() => handleSelect(sql, db, {}, 'all')).toThrow();
  });

  it('throws if column does not exist', () => {
    const sql = `SELECT notacol FROM ${tableName}`;
    expect(() => handleSelect(sql, db, {}, 'all')).toThrow();
  });

  it('throws if missing bind argument', () => {
    const sql = `SELECT * FROM ${tableName} WHERE ${colA} = :id`;
    expect(() => handleSelect(sql, db, {}, 'all')).toThrow();
  });

  it('throws on malformed SQL', () => {
    expect(() => handleSelect('SELECT', db, {}, 'all')).toThrow();
    expect(() => handleSelect('SELECT *', db, {}, 'all')).toThrow();
  });
});
