import { describe, it, expect } from 'vitest';
import { matchesWhere } from '../../src/engine/where/whereMatcher';

// Minimal D1Row type for test clarity
interface D1Row { [key: string]: unknown; }

describe('matchesWhere', () => {
  it('returns false if no bindArgs or no condition', () => {
    expect(() => matchesWhere({ id: 1 }, '', {})).toThrow('Malformed WHERE clause');
    expect(() => matchesWhere({ id: 1 }, 'id = :id', {})).toThrow('Missing bind argument: id');
  });

  it('matches a single equality condition', () => {
    expect(matchesWhere({ id: 1 }, 'id = :id', { id: 1 })).toBe(true);
    expect(matchesWhere({ id: 2 }, 'id = :id', { id: 1 })).toBe(false);
  });

  it('is case-insensitive for row keys', () => {
    expect(matchesWhere({ ID: 1 }, 'id = :id', { id: 1 })).toBe(true);
    expect(matchesWhere({ Name: 'Alice' }, 'name = :name', { name: 'Alice' })).toBe(true);
  });

  it('supports quoted/keyword columns', () => {
    expect(matchesWhere({ select: 42 }, '"select" = :val', { val: 42 })).toBe(true);
    expect(matchesWhere({ 'weird$col': 5 }, '`weird$col` = :v', { v: 5 })).toBe(true);
  });

  it('matches AND/OR logic', () => {
    const row: D1Row = { a: 1, b: 2, c: 3 };
    expect(matchesWhere(row, 'a = :a AND b = :b', { a: 1, b: 2 })).toBe(true);
    expect(matchesWhere(row, 'a = :a AND b = :b', { a: 1, b: 3 })).toBe(false);
    expect(matchesWhere(row, 'a = :a OR b = :b', { a: 2, b: 2 })).toBe(true);
    expect(matchesWhere(row, 'a = :a OR b = :b', { a: 2, b: 3 })).toBe(false);
    expect(matchesWhere(row, 'a = :a OR b = :b AND c = :c', { a: 2, b: 2, c: 3 })).toBe(true);
  });

  it('returns false for malformed conditions', () => {
    expect(matchesWhere({ id: 1 }, 'id == :id', { id: 1 })).toBe(false);
    expect(matchesWhere({ id: 1 }, 'id = id', { id: 1 })).toBe(false);
    expect(matchesWhere({ id: 1 }, 'id = :', { id: 1 })).toBe(false);
  });

  it('returns false if bind value is missing', () => {
    expect(() => matchesWhere({ id: 1 }, 'id = :id', {})).toThrow('Missing bind argument: id');
  });
});
