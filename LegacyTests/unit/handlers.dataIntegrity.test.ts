import { describe, it, expect } from 'vitest';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';
import { handleUpdate } from '../../src/engine/statementHandlers/handleUpdate';
import { handleSelect } from '../../src/engine/statementHandlers/handleSelect';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('Data Integrity & Consistency', () => {
  it('handles various data types', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, active BOOLEAN, name TEXT)', db);
    handleInsert('INSERT INTO users (id, active, name) VALUES (:id, :active, :name)', db, { id: 1, active: true, name: 'Alice' });
    const result = handleSelect('SELECT * FROM users', db, {}, 'all');
    expect(result.results[0].active).toBe(true);
  });
  it('throws on missing bind parameter', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    expect(() => handleInsert('INSERT INTO users (id) VALUES (:id)', db, {})).toThrow();
  });
  it('is case-insensitive for table/column names', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE Users (ID INTEGER)', db);
    handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: 1 });
    const result = handleSelect('SELECT * FROM USERS', db, {}, 'all');
    expect(result.results[0].id).toBe(1);
  });
});
