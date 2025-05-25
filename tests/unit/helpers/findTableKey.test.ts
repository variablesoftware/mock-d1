import { describe, it, expect } from 'vitest';
import { findTableKey } from '../../../src/helpers/findTableKey.js';

function makeDb(keys: string[]): Map<string, unknown> {
  const db = new Map<string, unknown>();
  for (const k of keys) db.set(k, {});
  return db;
}

describe('findTableKey (helpers)', () => {
  it('finds exact match', () => {
    const db = makeDb(['foo', 'bar']);
    expect(findTableKey(db, 'foo')).toBe('foo');
    expect(findTableKey(db, 'bar')).toBe('bar');
  });

  it('finds case-insensitive match', () => {
    const db = makeDb(['foo', 'BAR']);
    expect(findTableKey(db, 'FOO')).toBe('foo');
    expect(findTableKey(db, 'bar')).toBe('BAR');
  });

  it('returns undefined if not found', () => {
    const db = makeDb(['foo']);
    expect(findTableKey(db, 'baz')).toBeUndefined();
  });

  it('handles quoted table names', () => {
    const db = makeDb(['"MyTable"']);
    expect(findTableKey(db, '"MyTable"')).toBe('"MyTable"');
    expect(findTableKey(db, 'mytable')).toBeUndefined();
  });
});
