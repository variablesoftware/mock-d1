import { describe, it, expect } from 'vitest';
import { handleUpdate } from '../../src/engine/statementHandlers/handleUpdate';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('handleUpdate', () => {
  it('updates a row', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    const result = handleUpdate('UPDATE users SET name = :name WHERE id = :id', db, { id: 1, name: 'Bob' });
    expect(result.success).toBe(true);
  });
});
