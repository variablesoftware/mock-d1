import { describe, it, expect } from 'vitest';
import { extractTableName, normalizeTableName, getTableKey } from '../../src/engine/tableUtils/tableNameUtils.js';
import { randomSnake } from '../helpers/index.js';

describe('tableNameUtils', () => {
  it('extracts table name from various SQL statements', () => {
    const t1 = randomSnake();
    const t2 = '"' + randomSnake() + '"';
    const t3 = '`' + randomSnake() + '`';
    const t4 = '[' + randomSnake() + ']';
    expect(extractTableName(`CREATE TABLE ${t1} (id INT)`, 'CREATE')).toBe(t1);
    expect(extractTableName(`INSERT INTO ${t2} (id) VALUES (1)`, 'INSERT')).toBe(t2);
    expect(extractTableName(`DELETE FROM ${t3} WHERE id=1`, 'DELETE')).toBe(t3);
    expect(extractTableName(`SELECT * FROM ${t4}`, 'SELECT')).toBe(t4);
    expect(extractTableName(`UPDATE ${t1} SET id=2`, 'UPDATE')).toBe(t1);
    expect(extractTableName(`TRUNCATE TABLE ${t1}`, 'TRUNCATE')).toBe(t1);
    expect(extractTableName(`ALTER TABLE ${t2} ADD COLUMN x INT`, 'ALTER')).toBe(t2);
    expect(extractTableName(`DROP TABLE ${t1}`, 'DROP')).toBe(t1);
  });

  it('throws on malformed SQL', () => {
    expect(() => extractTableName('SELECT FROM', 'SELECT')).toThrow();
    expect(() => extractTableName('INSERT users', 'INSERT')).toThrow();
  });

  it('normalizes table names (quoted/unquoted)', () => {
    const t1 = randomSnake();
    const t2 = '"' + randomSnake() + '"';
    expect(normalizeTableName(t1)).toBe(t1);
    expect(normalizeTableName(t1.toUpperCase())).toBe(t1);
    expect(normalizeTableName(t2)).toBe(t2);
  });

  it('gets table key from db map', () => {
    const t1 = randomSnake();
    const t2 = '"' + randomSnake() + '"';
    const t3 = randomSnake();
    const db = new Map([
      [t1, {}],
      [t2, {}],
      [t3, {}],
    ]);
    expect(getTableKey(db, t1)).toBe(t1);
    expect(getTableKey(db, t1.toUpperCase())).toBe(t1);
    expect(getTableKey(db, t2)).toBe(t2);
    // For quoted table names, only the exact quoted name matches
    expect(getTableKey(db, t2.replace(/"/g, ''))).toBeUndefined();
    expect(getTableKey(db, randomSnake())).toBeUndefined();
  });
});

describe('extractTableName', () => {
  it('extracts table name from CREATE TABLE', () => {
    expect(extractTableName('CREATE TABLE my_table (id INT)', 'CREATE')).toBe('my_table');
    expect(extractTableName('CREATE TABLE "MyTable" (id INT)', 'CREATE')).toBe('"MyTable"');
    expect(extractTableName('CREATE TABLE [MyTable] (id INT)', 'CREATE')).toBe('[MyTable]');
    expect(extractTableName('CREATE TABLE IF NOT EXISTS my_table (id INT)', 'CREATE')).toBe('my_table');
  });
  it('extracts table name from INSERT INTO', () => {
    expect(extractTableName('INSERT INTO foo VALUES (1)', 'INSERT')).toBe('foo');
    expect(extractTableName('INSERT INTO "Foo" VALUES (1)', 'INSERT')).toBe('"Foo"');
  });
  it('extracts table name from DELETE FROM', () => {
    expect(extractTableName('DELETE FROM bar WHERE id=1', 'DELETE')).toBe('bar');
    expect(extractTableName('DELETE FROM `Bar` WHERE id=1', 'DELETE')).toBe('`Bar`');
  });
  it('extracts table name from SELECT ... FROM', () => {
    expect(extractTableName('SELECT * FROM baz', 'SELECT')).toBe('baz');
    expect(extractTableName('SELECT * FROM [Baz]', 'SELECT')).toBe('[Baz]');
  });
  it('extracts table name from UPDATE', () => {
    expect(extractTableName('UPDATE qux SET x=1', 'UPDATE')).toBe('qux');
    expect(extractTableName('UPDATE "Qux" SET x=1', 'UPDATE')).toBe('"Qux"');
  });
  it('extracts table name from TRUNCATE TABLE', () => {
    expect(extractTableName('TRUNCATE TABLE t1', 'TRUNCATE')).toBe('t1');
    expect(extractTableName('TRUNCATE TABLE `T1`', 'TRUNCATE')).toBe('`T1`');
  });
  it('extracts table name from ALTER TABLE', () => {
    expect(extractTableName('ALTER TABLE t2 ADD COLUMN x INT', 'ALTER')).toBe('t2');
    expect(extractTableName('ALTER TABLE "T2" ADD COLUMN x INT', 'ALTER')).toBe('"T2"');
  });
  it('extracts table name from DROP TABLE', () => {
    expect(extractTableName('DROP TABLE t3', 'DROP')).toBe('t3');
    expect(extractTableName('DROP TABLE [T3]', 'DROP')).toBe('[T3]');
  });
  it('throws on malformed SQL', () => {
    expect(() => extractTableName('CREATE my_table', 'CREATE')).toThrow();
    expect(() => extractTableName('INSERT foo VALUES (1)', 'INSERT')).toThrow();
  });
});

describe('normalizeTableName', () => {
  it('preserves quoted names as-is', () => {
    expect(normalizeTableName('"Foo"')).toBe('"Foo"');
    expect(normalizeTableName('`Bar`')).toBe('`Bar`');
    expect(normalizeTableName('[Baz]')).toBe('[Baz]');
  });
  it('lowercases unquoted names', () => {
    expect(normalizeTableName('FOO')).toBe('foo');
    expect(normalizeTableName('Bar')).toBe('bar');
    expect(normalizeTableName('baz')).toBe('baz');
  });
});

describe('getTableKey', () => {
  it('finds exact match for quoted', () => {
    const db = new Map([
      ['"Foo"', {}],
      ['bar', {}],
    ]);
    expect(getTableKey(db, '"Foo"')).toBe('"Foo"');
    expect(getTableKey(db, 'bar')).toBe('bar');
  });
  it('finds normalized match for unquoted', () => {
    const db = new Map([
      ['foo', {}],
      ['bar', {}],
    ]);
    expect(getTableKey(db, 'FOO')).toBe('foo');
    expect(getTableKey(db, 'BAR')).toBe('bar');
  });
  it('returns undefined if not found', () => {
    const db = new Map([
      ['foo', {}],
    ]);
    expect(getTableKey(db, 'baz')).toBeUndefined();
  });
});
