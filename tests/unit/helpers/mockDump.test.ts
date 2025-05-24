import { describe, it, expect } from 'vitest';
import { mockDump } from '../../../src/helpers/mockDump';

describe('mockDump', () => {
  it('dumps a simple db with one table', () => {
    const db = new Map();
    db.set('foo', {
      columns: [
        { name: 'id', quoted: false },
        { name: 'name', quoted: false }
      ],
      rows: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]
    });
    const dump = mockDump(db);
    expect(dump).toContain('foo');
    expect(dump).toContain('Alice');
    expect(dump).toContain('Bob');
  });

  it('handles empty db', () => {
    const db = new Map();
    const dump = mockDump(db);
    expect(typeof dump).toBe('string');
    expect(dump.length).toBeGreaterThan(0);
    expect(dump).toBe('{}');
  });

  it('handles table with no rows', () => {
    const db = new Map();
    db.set('empty', { columns: [{ name: 'id', quoted: false }], rows: [] });
    const dump = mockDump(db);
    expect(dump).toContain('empty');
    expect(dump).toContain('columns');
    expect(dump).toContain('rows');
  });
});
