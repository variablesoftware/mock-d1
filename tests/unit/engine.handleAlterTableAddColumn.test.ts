import { describe, it, expect, beforeEach } from 'vitest';
import { handleAlterTableAddColumn } from '../../src/engine/statementHandlers/handleAlterTableAddColumn.js';
import { randomSnake } from '../helpers/index.js';

function makeTable(columns, rows) {
  // Simulate the backend shape: columns is an object, not array
  const colObj = Object.fromEntries(columns.map(c => [c, null]));
  return {
    columns: colObj,
    rows: rows.map(r => ({ ...r })),
  };
}

describe('handleAlterTableAddColumn', () => {
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

  it('adds a new unquoted column', () => {
    const newCol = randomSnake();
    const sql = `ALTER TABLE ${tableName} ADD COLUMN ${newCol} TEXT`;
    const result = handleAlterTableAddColumn(sql, db);
    expect(result.success).toBe(true);
    const table = db.get(tableName);
    expect(Object.keys(table.columns)).toContain(newCol.toLowerCase());
    expect(table.rows[0][newCol.toLowerCase()]).toBeNull();
  });

  it('adds a new quoted column', () => {
    const newCol = randomSnake();
    const sql = `ALTER TABLE ${tableName} ADD COLUMN "${newCol}" TEXT`;
    const result = handleAlterTableAddColumn(sql, db);
    expect(result.success).toBe(true);
    const table = db.get(tableName);
    expect(Object.keys(table.columns)).toContain(newCol);
    expect(table.rows[0][newCol]).toBeNull();
  });

  it('throws on duplicate unquoted column', () => {
    const sql = `ALTER TABLE ${tableName} ADD COLUMN ${colA} TEXT`;
    expect(() => handleAlterTableAddColumn(sql, db)).toThrow();
  });

  it('throws on duplicate quoted column', () => {
    const sql = `ALTER TABLE ${tableName} ADD COLUMN "${colB}" TEXT`;
    expect(() => handleAlterTableAddColumn(sql, db)).toThrow();
  });

  it('throws if table does not exist', () => {
    const sql = `ALTER TABLE not_a_table ADD COLUMN foo TEXT`;
    expect(() => handleAlterTableAddColumn(sql, db)).toThrow();
  });

  it('throws on unsupported column type', () => {
    const sql = `ALTER TABLE ${tableName} ADD COLUMN foo UNSUPPORTEDTYPE`;
    expect(() => handleAlterTableAddColumn(sql, db)).toThrow();
  });

  it('throws on malformed SQL', () => {
    expect(() => handleAlterTableAddColumn('ALTER', db)).toThrow();
    expect(() => handleAlterTableAddColumn('ALTER TABLE', db)).toThrow();
    expect(() => handleAlterTableAddColumn(`ALTER TABLE ${tableName} ADD COLUMN`, db)).toThrow();
  });
});
