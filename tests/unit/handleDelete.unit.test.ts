import { describe, it, expect } from 'vitest';
import { handleDelete } from '../../src/engine/statementHandlers/handleDelete';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('handleDelete', () => {
  it('deletes a row', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    const result = handleDelete('DELETE FROM users WHERE id = :id', db, { id: 1 });
    expect(result.success).toBe(true);
  });
});
