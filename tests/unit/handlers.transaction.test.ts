import { describe, it, expect } from 'vitest';
import { mockD1Database } from '../../src/mockD1Database';

describe('Transaction-like Behavior', () => {
  it('batch executes multiple statements', async () => {
    const db = mockD1Database();
    const stmt1 = db.prepare('CREATE TABLE users (id INTEGER)');
    const stmt2 = db.prepare('INSERT INTO users (id) VALUES (:id)').bind({ id: 1 });
    const results = await db.batch([stmt1, stmt2]);
    expect(results.length).toBe(2);
  });
});
