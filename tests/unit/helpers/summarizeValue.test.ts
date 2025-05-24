import { describe, it, expect } from 'vitest';
import { summarizeValue, summarizeRow } from '../../../src/helpers/summarizeValue.js';

describe('summarizeValue', () => {
  it('summarizes long strings', () => {
    expect(summarizeValue('abcdefghij')).toBe('[str:10]ab..ij');
    expect(summarizeValue('short')).toBe('short');
  });

  it('summarizes arrays', () => {
    expect(summarizeValue([1, 2, 3])).toBe('[array:3]');
    expect(summarizeValue([])).toBe('[array:0]');
  });

  it('summarizes plain objects recursively', () => {
    const obj = { foo: 'abcdefghij', bar: [1, 2], baz: { deep: 'abcdefghij' } };
    expect(summarizeValue(obj)).toEqual({
      foo: '[str:10]ab..ij',
      bar: '[array:2]',
      baz: { deep: '[str:10]ab..ij' }
    });
  });

  it('summarizes non-plain objects as [object]', () => {
    class MyClass {}
    expect(summarizeValue(new MyClass())).toBe('[object]');
    expect(summarizeValue(new Date())).toBe('[object]');
  });

  it('returns primitives unchanged', () => {
    expect(summarizeValue(42)).toBe(42);
    expect(summarizeValue(null)).toBe(null);
    expect(summarizeValue(undefined)).toBe(undefined);
    expect(summarizeValue(true)).toBe(true);
  });
});

describe('summarizeRow', () => {
  it('summarizes all values in a row', () => {
    const row = { a: 'abcdefghij', b: [1, 2, 3], c: 42 };
    expect(summarizeRow(row)).toEqual({ a: '[str:10]ab..ij', b: '[array:3]', c: 42 });
  });

  it('returns null/undefined as is', () => {
    expect(summarizeRow(null)).toBe(null);
    expect(summarizeRow(undefined)).toBe(undefined);
  });
});
