import { describe, it, expect } from 'vitest';
import { mockD1Database } from '../../src';

describe('Helpers and Utilities', () => {
  it('dump returns correct snapshot', () => {
    const db = mockD1Database();
    db.inject('users', [{ id: 1 }]);
    const snapshot = db.dump();
    expect(snapshot.users.rows[0]).toHaveProperty('id');
  });
  it('inject restores state', () => {
    const db = mockD1Database();
    db.inject('users', [{ id: 1 }]);
    db.inject('users', [{ id: 2 }]);
    const snapshot = db.dump();
    expect(snapshot.users.rows.some(r => r.id === 2)).toBe(true);
  });
  it('schema evolution: add column to existing table', () => {
    const db = mockD1Database();
    db.inject('users', [{ id: 1 }]);
    expect(() => db.inject('users', [{ id: 2, name: 'Bob' }])).toThrow();
  });
});
