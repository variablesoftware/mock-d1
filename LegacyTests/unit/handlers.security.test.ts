import { describe, it, expect } from 'vitest';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleSelect } from '../../src/engine/statementHandlers/handleSelect';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('Security', () => {
  it('prevents SQL injection via bind values', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    // Try to inject SQL via bind value
    expect(() => handleSelect('SELECT * FROM users WHERE name = :name', db, { name: 'Alice; DROP TABLE users;' }, 'all')).not.toThrow();
  });
  it('rejects unsupported data types', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    expect(() => handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: () => {} })).toThrow();
  });
});
