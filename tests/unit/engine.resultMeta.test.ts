import { describe, it, expect } from 'vitest';
import { makeMetaFields } from '../../src/engine/resultMeta.js';

describe('makeMetaFields', () => {
  it('returns all default meta fields when called with no arguments', () => {
    const meta = makeMetaFields();
    expect(meta).toEqual({
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: 0,
      last_row_id: 0,
      changed_db: false,
      changes: 0,
    });
  });

  it('overrides individual fields when provided', () => {
    const meta = makeMetaFields({
      duration: 5,
      size_after: 100,
      rows_read: 10,
      rows_written: 2,
      last_row_id: 42,
      changed_db: true,
      changes: 7,
    });
    expect(meta).toEqual({
      duration: 5,
      size_after: 100,
      rows_read: 10,
      rows_written: 2,
      last_row_id: 42,
      changed_db: true,
      changes: 7,
    });
  });

  it('merges partial overrides with defaults', () => {
    const meta = makeMetaFields({ rows_read: 3, changed_db: true });
    expect(meta).toEqual({
      duration: 0,
      size_after: 0,
      rows_read: 3,
      rows_written: 0,
      last_row_id: 0,
      changed_db: true,
      changes: 0,
    });
  });

  it('does not mutate the input argument', () => {
    const input = { duration: 1 };
    const copy = { ...input };
    makeMetaFields(input);
    expect(input).toEqual(copy);
  });
});
