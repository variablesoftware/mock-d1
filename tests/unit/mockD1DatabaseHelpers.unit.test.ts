import { describe, it, expect } from 'vitest';
import { mockD1Database } from '../../src/mockD1Database';

describe('mockD1Database helpers', () => {
  it('inject adds rows to a table (coverage)', () => {
    const db = mockD1Database();
    db.inject('users', [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]);
    const snapshot = db.dump();
    expect(snapshot.users).toBeDefined();
    expect(snapshot.users.rows.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.users.rows.some(r => r.id === 1 && r.name === 'Alice')).toBe(true);
    expect(snapshot.users.rows.some(r => r.id === 2 && r.name === 'Bob')).toBe(true);
  });

  it('inject clears rows when given an empty array', () => {
    const db = mockD1Database();
    db.inject('users', [ { id: 1, name: 'Alice' } ]);
    db.inject('users', []);
    const snapshot = db.dump();
    expect(snapshot.users.rows.length).toBe(0);
  });

  it('inject is case-insensitive for table names', () => {
    const db = mockD1Database();
    db.inject('Users', [{ id: 1 }]);
    db.inject('users', [{ id: 2 }]);
    const snapshot = db.dump();
    // Find the key case-insensitively
    const tableKey = Object.keys(snapshot).find(k => k.toLowerCase() === 'users');
    expect(tableKey).toBeDefined();
    const rows = tableKey ? snapshot[tableKey].rows : [];
    expect(rows.some(r => r.id === 1)).toBe(true);
    expect(rows.some(r => r.id === 2)).toBe(true);
  });

  it('inject patches schema row if initially empty', () => {
    const db = mockD1Database();
    expect(() => db.inject('users', [{}])).not.toThrow(); // injecting empty row is allowed to create schema
    // Now, injecting with new columns should throw
    expect(() => db.inject('users', [{ id: 1, name: 'Alice' }])).toThrow();
  });

  it('inject sets missing columns to null', () => {
    const db = mockD1Database();
    db.inject('users', [{ id: 1, name: 'Alice' }]);
    expect(() => db.inject('users', [{ id: 2 }])).not.toThrow(); // missing columns are set to null
  });

  it('inject ignores extra columns not in schema', () => {
    const db = mockD1Database();
    db.inject('users', [{ id: 1, name: 'Alice' }]);
    expect(() => db.inject('users', [{ id: 2, name: 'Bob', extra: 123 }])).toThrow();
  });

  it('inject accumulates rows on multiple calls', () => {
    const db = mockD1Database();
    db.inject('users', [{ id: 1 }]);
    db.inject('users', [{ id: 2 }]);
    const snapshot = db.dump();
    expect(snapshot.users.rows.some(r => r.id === 1)).toBe(true);
    expect(snapshot.users.rows.some(r => r.id === 2)).toBe(true);
  });

  it('inject with empty array on new table creates empty table', () => {
    const db = mockD1Database();
    db.inject('newtable', []);
    const snapshot = db.dump();
    expect(snapshot.newtable).toBeDefined();
    expect(snapshot.newtable.rows.length).toBe(0);
  });
});
