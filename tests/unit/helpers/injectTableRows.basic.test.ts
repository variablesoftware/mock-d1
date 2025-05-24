import { describe, it, expect } from 'vitest';
import { injectTableRows } from '../../../src/helpers/injectTableRows.js';
import { randomSnake, randomInt } from '../../helpers/index.js';

describe('injectTableRows', () => {
  it('injects rows into an existing table', () => {
    const db = new Map();
    const columns = [
      { original: 'id', name: 'id', quoted: false },
      { original: 'val', name: 'val', quoted: false }
    ];
    db.set('bar', { columns, rows: [] });
    injectTableRows(db, 'bar', columns, [
      { id: randomInt(), val: randomSnake() },
      { id: randomInt(), val: randomSnake() }
    ]);
    const table = db.get('bar');
    expect(table?.rows.length).toBe(2);
    expect(typeof table?.rows[0].val).toBe('string');
    expect(typeof table?.rows[1].val).toBe('string');
  });

  it('creates table if not exists', () => {
    const db = new Map();
    const columns = [
      { original: 'id', name: 'id', quoted: false },
      { original: 'foo', name: 'foo', quoted: false }
    ];
    injectTableRows(db, 'baz', columns, [
      { id: randomInt(), foo: randomSnake() }
    ]);
    expect(db.has('baz')).toBe(true);
    const table = db.get('baz');
    expect(table?.rows.length).toBe(1);
    expect(typeof table?.rows[0].foo).toBe('string');
  });
});
