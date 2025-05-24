import { describe, it, expect } from 'vitest';
import { injectTableRows } from '../../../src/helpers/injectTableRows.js';
import { randomSnake, randomInt } from '../../helpers/index.js';
import { D1_ERRORS } from '../../../src/engine/errors.js';

describe('injectTableRows (schema inference edge cases)', () => {
  it('infers schema from first row only (throws on extra keys in later rows)', () => {
    const db = new Map();
    const colA = randomSnake();
    const colB = randomSnake();
    const colC = randomSnake();
    const tableName = 'edgecase_' + randomSnake();
    const columns = [
      { original: colA, name: colA, quoted: false },
      { original: colB, name: colB, quoted: false }
    ];
    injectTableRows(db, tableName, columns, [
      { [colA]: randomInt(), [colB]: randomInt() }
    ]);
    expect(() => injectTableRows(db, tableName, columns, [ { [colA]: randomInt(), [colB]: randomInt(), [colC]: randomInt() } ])).toThrow(
      /Attempted to insert with columns not present in schema/
    );
    const table = db.get(tableName);
    expect(table?.columns.map(c => c.name)).toEqual([colA, colB]);
    expect(table?.rows.length).toBe(1);
    expect(table?.rows[0]).toEqual({ [colA]: expect.any(Number), [colB]: expect.any(Number) });
  });

  it('creates table with empty schema if rows is empty', () => {
    const db = new Map();
    // Provide a dummy column to satisfy the non-empty columns requirement
    const columns = [
      { original: 'dummy', name: 'dummy', quoted: false }
    ];
    injectTableRows(db, 'empty_' + randomSnake(), columns, []);
    const table = Array.from(db.values())[0];
    expect(table?.columns).toEqual(columns);
    expect(table?.rows).toEqual([]);
  });

  it('after schema inference, only the normalized key (not the quoted key) is accepted for quoted columns; inserting with the quoted key throws', () => {
    const db = new Map();
    const normCol = randomSnake();
    const quotedCol = '"' + normCol + '"';
    const unquotedCol = randomSnake();
    const tableName = 'quoted_' + randomSnake();
    // Explicitly define columns for injection (no inference)
    const columns = [
      { original: quotedCol, name: normCol, quoted: true },
      { original: unquotedCol, name: unquotedCol, quoted: false }
    ];
    injectTableRows(db, tableName, columns, [
      { [quotedCol]: randomInt(), [unquotedCol]: randomInt() }
    ]);
    // Attempt to insert with quoted key again (should succeed)
    const quotedRow = {};
    quotedRow[quotedCol] = randomInt();
    quotedRow[unquotedCol] = randomInt();
    expect(() => injectTableRows(db, tableName, columns, [quotedRow])).not.toThrow();
    // Attempt to insert with normalized (unquoted) key (should throw)
    const normRow = {};
    normRow[normCol] = randomInt();
    normRow[unquotedCol] = randomInt();
    expect(() => injectTableRows(db, tableName, columns, [normRow])).toThrowError(
      new RegExp(`${D1_ERRORS.EXTRA_COLUMNS}.*${normCol}`)
    );
    const table = db.get(tableName);
    expect(table?.columns).toEqual(columns);
    expect(table?.rows[0]).toEqual({ [normCol]: expect.any(Number), [unquotedCol]: expect.any(Number) });
    expect(table?.rows[1]).toEqual({ [normCol]: expect.any(Number), [unquotedCol]: expect.any(Number) });
  });
});
