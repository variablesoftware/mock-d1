import { describe, it, expect } from 'vitest';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';
import { handleSelect } from '../../src/engine/statementHandlers/handleSelect';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('Advanced SQL Features', () => {
  it('handles complex WHERE clauses', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 2, name: 'Bob' });
    const result = handleSelect('SELECT * FROM users WHERE id = :id OR name = :name', db, { id: 2, name: 'Alice' }, 'all');
    expect(result.results.length).toBe(2);
  });
  it('selects a subset of columns', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    const result = handleSelect('SELECT id FROM users', db, {}, 'all');
    expect(result.results[0].id).toBe(1);
    expect(result.results[0].name).toBeUndefined();
  });
  it('handles SELECT COUNT(*)', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: 1 });
    handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: 2 });
    const result = handleSelect('SELECT COUNT(*) FROM users', db, {}, 'all');
    expect(result.results[0]['COUNT(*)']).toBe(2);
  });
});
