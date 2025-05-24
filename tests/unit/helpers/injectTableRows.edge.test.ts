import { describe, it, expect } from 'vitest';
import { injectTableRows } from '../../../src/helpers/injectTableRows.js';
import { randomSnake, randomInt } from '../../helpers/index.js';

describe('injectTableRows (edge and error cases)', () => {
  it('injects into a new table and creates schema row', () => {
    const db = new Map();
    const columns = [
      { original: 'id', name: 'id', quoted: false },
      { original: 'name', name: 'name', quoted: false }
    ];
    injectTableRows(db, 'users', columns, [
      { id: randomInt(), name: randomSnake() },
      { id: randomInt(), name: randomSnake() }
    ]);
    const table = db.get('users');
    expect(table?.rows.length).toBe(2);
    expect(Object.keys(table?.rows[0] || {})).toEqual(['id', 'name']);
    expect(typeof table?.rows[0].id).toBe('number');
    expect(typeof table?.rows[1].name).toBe('string');
  });

  it('injects empty array to clear table', () => {
    const db = new Map();
    const columns = [ { original: 'id', name: 'id', quoted: false } ];
    injectTableRows(db, 'foo', columns, [ { id: randomInt() } ]);
    injectTableRows(db, 'foo', columns, []);
    const table = db.get('foo');
    expect(table?.rows.length).toBe(0);
  });

  it('throws if injecting row with extra columns', () => {
    const db = new Map();
    const columns = [
      { original: 'id', name: 'id', quoted: false },
      { original: 'name', name: 'name', quoted: false }
    ];
    injectTableRows(db, 'foo', columns, [ { id: randomInt(), name: randomSnake() } ]);
    expect(() => injectTableRows(db, 'foo', columns, [ { id: randomInt(), name: randomSnake(), extra: randomInt() } ])).toThrow(
      /Attempted to insert with columns not present in schema/
    );
  });

  it('fills missing columns with null', () => {
    const db = new Map();
    const columns = [
      { original: 'id', name: 'id', quoted: false },
      { original: 'name', name: 'name', quoted: false }
    ];
    injectTableRows(db, 'foo', columns, [ { id: randomInt(), name: randomSnake() } ]);
    injectTableRows(db, 'foo', columns, [ { id: randomInt() } ]);
    const table = db.get('foo');
    expect(table?.rows[1].name).toBeNull();
    expect(typeof table?.rows[1].id).toBe('number');
  });

  it('throws if schema row is empty and non-empty row is injected', () => {
    const db = new Map();
    const columns = [];
    db.set('foo', { columns, rows: [] });
    expect(() => injectTableRows(db, 'foo', columns, [ { id: randomInt() } ])).toThrow();
  });

  it('is case-insensitive for column names', () => {
    const db = new Map();
    const columns = [
      { original: 'ID', name: 'id', quoted: false },
      { original: 'Name', name: 'name', quoted: false }
    ];
    injectTableRows(db, 'foo', columns, [ { ID: randomInt(), Name: randomSnake() } ]);
    injectTableRows(db, 'foo', columns, [ { id: randomInt(), name: randomSnake() } ]);
    const table = db.get('foo');
    expect(table?.rows[1].ID ?? table?.rows[1].id).toBeDefined();
    expect(table?.rows[1].Name ?? table?.rows[1].name).toBeDefined();
  });
});
