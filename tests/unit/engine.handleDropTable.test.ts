import { describe, it, expect, beforeEach } from 'vitest';
import { handleDropTable } from '../../src/engine/statementHandlers/handleDropTable.js';
import { randomSnake, randomInt, randomAlpha, randomData } from '../helpers/index.js';

function makeTable(columns, rows) {
  return {
    columns: columns.map(c => ({ name: c, quoted: false })),
    rows: rows.map(r => ({ ...r })),
  };
}

describe('handleDropTable', () => {
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

  it('removes the table from the db', () => {
    const sql = `DROP TABLE ${tableName}`;
    const result = handleDropTable(sql, db);
    expect(result.success).toBe(true);
    expect(db.has(tableName)).toBe(false);
  });

  it('throws if table does not exist', () => {
    const sql = `DROP TABLE not_a_table`;
    expect(() => handleDropTable(sql, db)).toThrow();
  });

  it('throws on malformed SQL', () => {
    expect(() => handleDropTable('DROP', db)).toThrow();
    expect(() => handleDropTable('DROP TABLE', db)).toThrow();
  });
});
