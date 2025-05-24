import { describe, it, expect } from 'vitest';
import { validateRowAgainstSchema, normalizeRowToSchema } from '../../src/engine/tableUtils/schemaUtils.js';
import { randomAlpha, randomSnake, randomData } from '../helpers/index.js';

describe('schemaUtils', () => {
  const col1 = randomSnake();
  const col2 = randomSnake();
  const col3 = randomSnake();
  const columns = [
    { original: col1, name: col1, quoted: false },
    { original: col2, name: col2, quoted: true },
    { original: col3, name: col3, quoted: false },
  ];

  it('validates row with exact and case-insensitive columns', () => {
    // Use quoted key for quoted column to match D1/SQL rules
    const row = { [col1]: 1, [`"${col2}"`]: 'A', [col3]: 2 };
    expect(validateRowAgainstSchema(columns, row).result).toBe(true);
    const row2 = { [col1.toUpperCase()]: 1, [`"${col2}"`]: 'A', [col3.toUpperCase()]: 2 };
    expect(validateRowAgainstSchema(columns, row2).result).toBe(true);
  });

  it('throws on extra columns', () => {
    const row = { [col1]: 1, [`"${col2}"`]: 'A', [col3]: 2, extra: 5 };
    expect(() => validateRowAgainstSchema(columns, row)).toThrow();
    // D1/SQL: unquoted keys for quoted columns are considered extra, so this should throw
    const row2 = { [col1]: 1, [`"${col2}"`]: 'A', [col3]: 2, [col2.toUpperCase()]: 'B' };
    expect(() => validateRowAgainstSchema(columns, row2)).toThrow();
  });

  it('normalizes row to schema (fills missing with null)', () => {
    const row = { [col1]: 1, [col2]: 'A' };
    const norm = normalizeRowToSchema(columns, row);
    expect(norm[col1]).toBe(1);
    expect(norm[col2]).toBe('A');
    expect(norm[col3]).toBeNull();
  });

  it('normalizes with quoted/unquoted distinction', () => {
    const row = { [col1.toUpperCase()]: 2, [col2]: 'B', [col3]: 3 };
    const norm = normalizeRowToSchema(columns, row);
    expect(norm[col1]).toBe(2);
    expect(norm[col2]).toBe('B');
    expect(norm[col3]).toBe(3);
  });

  it('handles all missing columns', () => {
    const norm = normalizeRowToSchema(columns, {});
    expect(norm[col1]).toBeNull();
    expect(norm[col2]).toBeNull();
    expect(norm[col3]).toBeNull();
  });
});
