// Unit tests for matchesWhere in whereMatcher.ts
import { describe, it, expect } from 'vitest';
import { evaluateWhereClause } from '../../src/engine/where/evaluateWhereClause';

describe('matchesWhere', () => {
  it('matches simple equality', () => {
    expect(evaluateWhereClause('foo = :bar', { foo: 1 }, { bar: 1 })).toBe(true);
    expect(evaluateWhereClause('foo = :bar', { foo: 1 }, { bar: 2 })).toBe(false);
  });

  it('is case-insensitive for columns and bind args', () => {
    expect(evaluateWhereClause('foo = :BAR', { FOO: 1 }, { bar: 1 })).toBe(true);
    expect(evaluateWhereClause('FOO = :bar', { foo: 1 }, { BAR: 1 })).toBe(true);
  });

  it('handles quoted identifiers', () => {
    expect(evaluateWhereClause('`weird name` = :val', { 'weird name': 5 }, { val: 5 })).toBe(true);
    expect(evaluateWhereClause('"x" = :y', { 'x': 1 }, { y: 1 })).toBe(true);
  });

  it('handles AND/OR precedence', () => {
    expect(evaluateWhereClause('a = :x OR b = :y AND a = :x', { a: 1, b: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(evaluateWhereClause('a = :x AND b = :y', { a: 1, b: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(evaluateWhereClause('a = :x OR b = :z', { a: 1, b: 2 }, { x: 3, z: 2 })).toBe(true);
    expect(evaluateWhereClause('a = :x AND b = :z', { a: 1, b: 2 }, { x: 3, z: 2 })).toBe(false);
  });

  it('handles parentheses for grouping', () => {
    expect(evaluateWhereClause('(a = :x OR b = :y) AND a = :x', { a: 1, b: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(evaluateWhereClause('(a = :x OR b = :y) AND a = :z', { a: 1, b: 2 }, { x: 1, y: 2, z: 2 })).toBe(false);
  });

  it('treats null/undefined as equal', () => {
    expect(evaluateWhereClause('foo = :bar', { foo: null }, { bar: null })).toBe(true);
    expect(evaluateWhereClause('foo = :bar', { foo: undefined }, { bar: undefined })).toBe(true);
  });

  it('throws on missing bind arg', () => {
    expect(() => evaluateWhereClause('foo = :bar', { foo: 1 }, {})).toThrow();
  });

  it('returns false for malformed expressions', () => {
    expect(evaluateWhereClause('foo == :bar', { foo: 1 }, { bar: 1 })).toBe(false);
    expect(evaluateWhereClause('foo =', { foo: 1 }, { bar: 1 })).toBe(false);
  });

  it('throws on malformed WHERE clause: empty or incomplete expression', () => {
    expect(() => evaluateWhereClause('', { foo: 1 }, { bar: 1 })).toThrow(/Malformed WHERE clause/);
    expect(() => evaluateWhereClause('AND', { foo: 1 }, { bar: 1 })).toThrow(/Malformed WHERE clause/);
    expect(() => evaluateWhereClause('OR', { foo: 1 }, { bar: 1 })).toThrow(/Malformed WHERE clause/);
  });

  it('throws on malformed WHERE clause: unbalanced parentheses', () => {
    expect(() => evaluateWhereClause('(foo = :bar', { foo: 1 }, { bar: 1 })).toThrow(/unbalanced parentheses/);
    expect(() => evaluateWhereClause('foo = :bar)', { foo: 1 }, { bar: 1 })).toThrow(/unbalanced parentheses/);
  });

  it('throws on malformed WHERE clause: incomplete OR/AND condition', () => {
    expect(() => evaluateWhereClause('foo = :bar OR', { foo: 1 }, { bar: 1 })).toThrow(/incomplete OR condition/);
    expect(() => evaluateWhereClause('AND foo = :bar', { foo: 1 }, { bar: 1 })).toThrow(/incomplete AND condition/);
  });

  it('handles col IS NULL and col IS NOT NULL', () => {
    expect(evaluateWhereClause('foo IS NULL', { foo: null }, {})).toBe(true);
    expect(evaluateWhereClause('foo IS NULL', { foo: 1 }, {})).toBe(false);
    expect(evaluateWhereClause('foo IS NOT NULL', { foo: 1 }, {})).toBe(true);
    expect(evaluateWhereClause('foo IS NOT NULL', { foo: null }, {})).toBe(false);
  });

  it('handles quoted identifiers for IS NULL/IS NOT NULL', () => {
    expect(evaluateWhereClause('`bar baz` IS NULL', { 'bar baz': null }, {})).toBe(true);
    expect(evaluateWhereClause('`bar baz` IS NOT NULL', { 'bar baz': 1 }, {})).toBe(true);
  });

  it('handles typeof rowVal and fallback logic', () => {
    // Should match even if property is only present in original row, not normRow
    expect(evaluateWhereClause('FOO = :bar', { FOO: 1 }, { bar: 1 })).toBe(true);
    // Should match even if property is only present in normRow, not original row
    expect(evaluateWhereClause('foo = :bar', { foo: 1 }, { bar: 1 })).toBe(true);
  });

  it('handles while cond.startsWith (outer parens removal)', () => {
    expect(evaluateWhereClause('((foo = :bar))', { foo: 1 }, { bar: 1 })).toBe(true);
    expect(evaluateWhereClause('(((foo = :bar)))', { foo: 1 }, { bar: 1 })).toBe(true);
  });
});
