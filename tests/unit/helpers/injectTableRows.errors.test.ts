import { describe, it, expect } from 'vitest';
import { injectTableRows } from '../../../src/helpers/injectTableRows.js';
import { randomSnake, randomInt } from '../../helpers/index.js';

describe('injectTableRows (error cases)', () => {
  it('throws if table name is missing', () => {
    const db = new Map();
    // @ts-expect-error
    expect(() => injectTableRows(db, '', [{ id: 1 }])).toThrow();
  });
  it('throws if rows is not an array', () => {
    const db = new Map();
    // @ts-expect-error
    expect(() => injectTableRows(db, 'foo', null)).toThrow();
    // @ts-expect-error
    expect(() => injectTableRows(db, 'foo', {})).toThrow();
  });
  it('throws if columns do not match for existing table', () => {
    const db = new Map();
    db.set('bar', { rows: [{ id: undefined }] });
    expect(() => injectTableRows(db, 'bar', [{ val: 1 }])).toThrow();
  });
});
