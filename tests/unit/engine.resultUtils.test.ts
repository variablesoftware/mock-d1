import { describe, it, expect } from 'vitest';
import { makeD1Result } from '../../src/engine/resultUtils.js';

// Mock meta generator for test
function fakeMetaFields(meta?: any) {
  return {
    rowCount: 42,
    lastRowId: 99,
    ...meta,
  };
}

describe('makeD1Result', () => {
  it('returns a D1 result object with results and default meta', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const result = makeD1Result(rows);
    expect(result.results).toEqual(rows);
    expect(result.success).toBe(true);
    expect(result.meta).toBeDefined();
    expect(typeof result.meta).toBe('object');
  });

  it('merges provided meta fields', () => {
    const rows = [{ foo: 'bar' }];
    const meta = { rowCount: 5, lastRowId: 123 };
    const result = makeD1Result(rows, meta);
    expect(result.meta.rowCount).toBe(5);
    expect(result.meta.lastRowId).toBe(123);
  });

  it('handles empty results and meta', () => {
    const result = makeD1Result([]);
    expect(result.results).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.meta).toBeDefined();
  });

  it('does not mutate input arguments', () => {
    const rows = [{ a: 1 }];
    const meta = { rowCount: 1 };
    const rowsCopy = [...rows];
    const metaCopy = { ...meta };
    makeD1Result(rows, meta);
    expect(rows).toEqual(rowsCopy);
    expect(meta).toEqual(metaCopy);
  });
});
