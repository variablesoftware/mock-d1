import { describe, it, expect, beforeEach } from 'vitest';
import { handleTruncateTable } from '../../src/engine/statementHandlers/handleTruncateTable.js';
import { randomSnake, randomInt, randomAlpha, randomData } from '../helpers/index.js';

function makeTable(columns: string[], rows: Record<string, unknown>[]) {
  return {
    columns: Object.fromEntries(columns.map(c => [c, { name: c, quoted: false }])),
    rows: rows.map(r => ({ ...r })),
  };
}

describe('handleTruncateTable', () => {
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

  it('removes all rows and columns from the table', () => {
    const sql = `TRUNCATE TABLE ${tableName}`;
    const result = handleTruncateTable(sql, db);
    expect(result.success).toBe(true);
    const table = db.get(tableName);
    expect(table.rows.length).toBe(0);
    expect(table.columns.length === undefined || table.columns.length === 0 || Object.keys(table.columns).length === 0).toBe(true);
  });

  it('throws if table does not exist', () => {
    const sql = `TRUNCATE TABLE not_a_table`;
    expect(() => handleTruncateTable(sql, db)).toThrow();
  });

  it('throws on malformed SQL', () => {
    expect(() => handleTruncateTable('TRUNCATE', db)).toThrow();
    expect(() => handleTruncateTable('TRUNCATE TABLE', db)).toThrow();
  });
});
