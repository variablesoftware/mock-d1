import { describe, it, expect } from 'vitest';
import { createPreparedStatement } from '../../src/engine/mockD1PreparedStatement';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('MockD1PreparedStatement.raw', () => {
  it('returns all result rows for SELECT *', async () => {
    const db = newDb();
    db.set('users', { rows: [ { id: undefined, name: undefined }, { id: 1, name: 'Alice' }, { id: 2, name: 'Bob' } ] });
    const stmt = createPreparedStatement('SELECT * FROM users', db, undefined);
    const rows = await stmt.raw();
    expect(rows).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  });

  it('returns empty array if no results', async () => {
    const db = newDb();
    db.set('users', { rows: [ { id: undefined, name: undefined } ] });
    const stmt = createPreparedStatement('SELECT * FROM users', db, undefined);
    const rows = await stmt.raw();
    expect(rows).toEqual([]);
  });

  it('returns empty array if results is undefined', async () => {
    // Simulate a handler that returns { success: true } only
    const db = newDb();
    // Patch parseAndRun to return no results
    const stmt = createPreparedStatement('SELECT * FROM users', db, undefined);
    // @ts-expect-error: override for test
    stmt.parseAndRun = () => ({ success: true });
    // @ts-expect-error: call raw directly
    const rows = await stmt.raw();
    expect(rows).toEqual([]);
  });
});
