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

  it('throws on multiple statements (semicolon logic)', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: 1 });
    // Only a trailing semicolon is allowed
    expect(() => handleSelect('SELECT * FROM users; SELECT * FROM users', db, {}, 'all')).toThrow('Malformed SQL: multiple statements detected');
    // Trailing semicolon is fine
    expect(() => handleSelect('SELECT * FROM users;', db, {}, 'all')).not.toThrow();
  });

  it('throws if table does not exist (!tableKey)', () => {
    const db = newDb();
    expect(() => handleSelect('SELECT * FROM notfound', db, {}, 'all')).toThrow("Table 'notfound' does not exist in the database.");
  });

  it('throws if table does not exist for SELECT <columns> (selectColsMatch)', () => {
    const db = newDb();
    expect(() => handleSelect('SELECT id, name FROM notfound', db, {}, 'all')).toThrow("Table 'notfound' does not exist in the database.");
  });
});
