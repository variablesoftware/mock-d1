import { describe, it, expect } from 'vitest';
import { handleSelect } from '../../src/engine/statementHandlers/handleSelect';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('handleSelect', () => {
  it('selects rows', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    const result = handleSelect('SELECT * FROM users', db, {}, 'all');
    expect(result.success).toBe(true);
    expect(Array.isArray(result.results)).toBe(true);
  });
});
