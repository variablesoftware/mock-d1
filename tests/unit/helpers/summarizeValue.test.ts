import { describe, it, expect } from 'vitest';
import { summarizeValue, summarizeRow } from '../../../src/helpers/summarizeValue.js';
import { randomAlpha, randomSnake, randomInt, randomData } from '../../helpers/index.js';

describe('summarizeValue', () => {
  it('summarizes long strings', () => {
    const str = randomAlpha(20);
    const summary = summarizeValue(str);
    expect(typeof summary).toBe('string');
    expect(summary).toMatch(/^\[str:20\]/);
  });

  it('returns short strings unchanged', () => {
    const str = randomAlpha(5);
    expect(summarizeValue(str)).toBe(str);
  });

  it('summarizes arrays', () => {
    const arr = Array.from({ length: 5 }, () => randomInt());
    expect(summarizeValue(arr)).toBe('[array:5]');
  });

  it('summarizes objects recursively', () => {
    const keys = [randomSnake(), randomSnake()];
    const row = randomData(keys);
    const summary = summarizeValue(row);
    expect(typeof summary).toBe('object');
    for (const k of keys) {
      expect(Object.keys(summary as object)).toContain(k);
    }
  });

  it('summarizes non-plain objects as [object]', () => {
    class Foo { x = 1; }
    expect(summarizeValue(new Foo())).toBe('[object]');
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
    const keys = [randomSnake(), randomSnake()];
    const row = randomData(keys);
    const summary = summarizeRow(row);
    expect(typeof summary).toBe('object');
    for (const k of keys) {
      expect(Object.keys(summary as object)).toContain(k);
    }
  });

  it('returns null/undefined as is', () => {
    expect(summarizeRow(null)).toBe(null);
    expect(summarizeRow(undefined)).toBe(undefined);
  });
});
