import { describe, it, expect } from 'vitest';
import { injectTableRows } from '../../../src/helpers/injectTableRows.js';

describe('injectTableRows', () => {
  it('overwrites columns if table exists and columns differ', () => {
    const db = new Map();
    const tableName = 'my_table';
    const columns1 = [ { original: 'id', name: 'id', quoted: false } ];
    const columns2 = [ { original: 'id', name: 'id', quoted: false }, { original: 'foo', name: 'foo', quoted: false } ];
    // First inject with columns1
    injectTableRows(db, tableName, columns1, [ { id: 1 } ]);
    expect(db.get(tableName.toLowerCase())?.columns).toEqual(columns1);
    // Now inject with columns2 (should overwrite columns)
    injectTableRows(db, tableName, columns2, [ { id: 2, foo: 'bar' } ]);
    expect(db.get(tableName.toLowerCase())?.columns).toEqual(columns2);
    // The rows should also be present and valid
    expect(db.get(tableName.toLowerCase())?.rows.length).toBe(1);
    expect(db.get(tableName.toLowerCase())?.rows[0]).toEqual({ id: 2, foo: 'bar' });
  });
});
