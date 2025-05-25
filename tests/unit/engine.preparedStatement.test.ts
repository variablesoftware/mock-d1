import { describe, it, expect } from 'vitest';
import { createPreparedStatement } from '../../src/engine/preparedStatement.js';
import type { D1TableData } from '../../src/types/MockD1Database';
import { D1_ERRORS } from '../../src/engine/errors.js';

// Helper for column shape
function col(name: string, quoted = false): { name: string; quoted: boolean; original: string } {
  return { name, quoted, original: name };
}

function makeDb(tables: Record<string, D1TableData> = {}) {
  return new Map(Object.entries(tables));
}

describe('createPreparedStatement', () => {
  it('throws on multiple SQL statements', () => {
    expect(() => createPreparedStatement('SELECT 1; SELECT 2', makeDb())).toThrow(D1_ERRORS.MULTI_STATEMENT);
  });

  it('throws on unsupported SQL syntax (LIKE, BETWEEN, JOIN)', () => {
    expect(() => createPreparedStatement('SELECT * FROM foo WHERE bar LIKE "baz"', makeDb())).toThrow(D1_ERRORS.UNSUPPORTED_SQL);
    expect(() => createPreparedStatement('SELECT * FROM foo WHERE bar BETWEEN 1 AND 2', makeDb())).toThrow(D1_ERRORS.UNSUPPORTED_SQL);
    expect(() => createPreparedStatement('SELECT * FROM foo JOIN bar ON foo.id = bar.id', makeDb())).toThrow(D1_ERRORS.UNSUPPORTED_SQL);
  });

  it('throws on malformed SELECT at prepare-time', () => {
    expect(() => createPreparedStatement('SELECT 1', makeDb())).toThrow(D1_ERRORS.MALFORMED_SELECT);
  });

  it('throws on malformed INSERT at prepare-time', () => {
    expect(() => createPreparedStatement('INSERT INTO foo (id)', makeDb())).toThrow(D1_ERRORS.MALFORMED_INSERT);
  });

  it('throws on malformed DELETE at prepare-time', () => {
    expect(() => createPreparedStatement('DELETE foo', makeDb())).toThrow(D1_ERRORS.MALFORMED_DELETE);
  });

  it('throws on malformed UPDATE at prepare-time', () => {
    expect(() => createPreparedStatement('UPDATE foo', makeDb())).toThrow(D1_ERRORS.MALFORMED_UPDATE);
  });

  it('returns a prepared statement object with D1 methods', () => {
    const db = makeDb({ foo: { columns: [col('id')], rows: [{ id: 1 }] } });
    const stmt = createPreparedStatement('SELECT * FROM foo', db);
    expect(typeof stmt.bind).toBe('function');
    expect(typeof stmt.run).toBe('function');
    expect(typeof stmt.all).toBe('function');
    expect(typeof stmt.first).toBe('function');
    expect(typeof stmt.raw).toBe('function');
  });

  it('bind() sets bind arguments and is chainable', () => {
    const db = makeDb({ foo: { columns: [col('id')], rows: [{ id: 1 }] } });
    const stmt = createPreparedStatement('SELECT * FROM foo', db);
    const chained = stmt.bind({ id: 1 });
    expect(chained).toBe(stmt);
  });

  it('run(), all(), first() and raw() call the correct handler and return results', async () => {
    const db = makeDb({ foo: { columns: [col('id')], rows: [{ id: 1 }, { id: 2 }] } });
    const stmt = createPreparedStatement('SELECT * FROM foo', db);
    const all = await stmt.all();
    const first = await stmt.first();
    const run = await stmt.run();
    const raw = await stmt.raw();
    expect(Array.isArray(all.results)).toBe(true);
    expect(Array.isArray(raw)).toBe(true);
    expect(first.results.length).toBeLessThanOrEqual(all.results.length);
    expect(run.success).toBe(true);
  });

  it('raw() returns [] if handler throws or returns no results', async () => {
    const db = makeDb();
    const stmt = createPreparedStatement('SELECT * FROM missing', db);
    const raw = await stmt.raw();
    expect(raw).toEqual([]);
  });
});
