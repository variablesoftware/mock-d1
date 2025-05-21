import { describe, it, expect } from 'vitest';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('handleInsert', () => {
  it('inserts a row', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    const result = handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    expect(result.success).toBe(true);
    expect(db.get('users')?.rows.length).toBeGreaterThan(1);
  });
});
