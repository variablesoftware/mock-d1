import { describe, it, expect } from 'vitest';
import { filterSchemaRow } from '../../src/engine/helpers';

// Minimal D1Row type for test clarity
interface D1Row { [key: string]: unknown; }

describe('filterSchemaRow', () => {
  it('returns empty array if input is empty', () => {
    expect(filterSchemaRow([])).toEqual([]);
  });

  it('removes first row if all values are undefined', () => {
    const rows: D1Row[] = [
      { a: undefined, b: undefined },
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ];
    expect(filterSchemaRow(rows)).toEqual([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);
  });

  it('does not remove first row if any value is defined', () => {
    const rows: D1Row[] = [
      { a: undefined, b: 1 },
      { a: 2, b: 3 },
    ];
    expect(filterSchemaRow(rows)).toEqual(rows);
  });

  it('works with only one row', () => {
    expect(filterSchemaRow([{ a: undefined }])).toEqual([]);
    expect(filterSchemaRow([{ a: 1 }])).toEqual([{ a: 1 }]);
  });
});
