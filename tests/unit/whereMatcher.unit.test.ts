// Unit tests for matchesWhere in whereMatcher.ts
import { describe, it, expect } from 'vitest';
import { matchesWhere } from '../../src/engine/whereMatcher';

describe('matchesWhere', () => {
  it('matches simple equality', () => {
    expect(matchesWhere({ foo: 1 }, 'foo = :bar', { bar: 1 })).toBe(true);
    expect(matchesWhere({ foo: 1 }, 'foo = :bar', { bar: 2 })).toBe(false);
  });

  it('is case-insensitive for columns and bind args', () => {
    expect(matchesWhere({ FOO: 1 }, 'foo = :BAR', { bar: 1 })).toBe(true);
    expect(matchesWhere({ foo: 1 }, 'FOO = :bar', { BAR: 1 })).toBe(true);
  });

  it('handles quoted identifiers', () => {
    expect(matchesWhere({ 'weird name': 5 }, '`weird name` = :val', { val: 5 })).toBe(true);
    expect(matchesWhere({ 'x': 1 }, '"x" = :y', { y: 1 })).toBe(true);
  });

  it('handles AND/OR precedence', () => {
    expect(matchesWhere({ a: 1, b: 2 }, 'a = :x OR b = :y AND a = :x', { x: 1, y: 2 })).toBe(true);
    expect(matchesWhere({ a: 1, b: 2 }, 'a = :x AND b = :y', { x: 1, y: 2 })).toBe(true);
    expect(matchesWhere({ a: 1, b: 2 }, 'a = :x OR b = :z', { x: 3, z: 2 })).toBe(true);
    expect(matchesWhere({ a: 1, b: 2 }, 'a = :x AND b = :z', { x: 3, z: 2 })).toBe(false);
  });

  it('handles parentheses for grouping', () => {
    expect(matchesWhere({ a: 1, b: 2 }, '(a = :x OR b = :y) AND a = :x', { x: 1, y: 2 })).toBe(true);
    expect(matchesWhere({ a: 1, b: 2 }, '(a = :x OR b = :y) AND a = :z', { x: 1, y: 2, z: 2 })).toBe(false);
  });

  it('treats null/undefined as equal', () => {
    expect(matchesWhere({ foo: null }, 'foo = :bar', { bar: null })).toBe(true);
    expect(matchesWhere({ foo: undefined }, 'foo = :bar', { bar: undefined })).toBe(true);
  });

  it('throws on missing bind arg', () => {
    expect(() => matchesWhere({ foo: 1 }, 'foo = :bar', {})).toThrow();
  });

  it('returns false for malformed expressions', () => {
    expect(matchesWhere({ foo: 1 }, 'foo == :bar', { bar: 1 })).toBe(false);
    expect(matchesWhere({ foo: 1 }, 'foo =', { bar: 1 })).toBe(false);
  });
});
