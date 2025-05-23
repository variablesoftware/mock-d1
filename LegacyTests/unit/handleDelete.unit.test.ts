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

  it('deletes all rows when no WHERE clause', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 2, name: 'Bob' });
    const result = handleDelete('DELETE FROM users', db, {});
    expect(result.success).toBe(true);
    expect(result.changes).toBe(2);
    expect(db.get('users')?.rows.length).toBe(1); // schema row remains
  });

  it('deletes using quoted table name', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE "users" (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO "users" (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    const result = handleDelete('DELETE FROM "users" WHERE id = :id', db, { id: 1 });
    expect(result.success).toBe(true);
    expect(result.changes).toBe(1);
  });

  it('deletes using SQL keyword as table name', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE select (id INTEGER)', db);
    handleInsert('INSERT INTO select (id) VALUES (:id)', db, { id: 1 });
    const result = handleDelete('DELETE FROM select WHERE id = :id', db, { id: 1 });
    expect(result.success).toBe(true);
    expect(result.changes).toBe(1);
  });

  it('is case-insensitive for table names', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE Users (id INTEGER)', db);
    handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: 1 });
    const result = handleDelete('DELETE FROM USERS WHERE id = :id', db, { id: 1 });
    expect(result.success).toBe(true);
    expect(result.changes).toBe(1);
  });

  it('throws if table does not exist', () => {
    const db = newDb();
    expect(() => handleDelete('DELETE FROM notfound WHERE id = :id', db, { id: 1 })).toThrow("Table 'notfound' does not exist in the database.");
  });

  it('throws on malformed DELETE statement', () => {
    const db = newDb();
    expect(() => handleDelete('DELETE', db, {})).toThrow('Malformed DELETE statement.');
    expect(() => handleDelete('DELETE FROM', db, {})).toThrow('Malformed DELETE statement.');
  });

  it('throws if missing bind argument', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: 1 });
    expect(() => handleDelete('DELETE FROM users WHERE id = :id', db, {})).toThrow('Missing bind argument: id');
  });

  it('deletes rows using AND/OR logic in WHERE', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 2, name: 'Bob' });
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 3, name: 'Carol' });
    // Delete where id = 1 OR name = 'Bob'
    let result = handleDelete('DELETE FROM users WHERE id = :id OR name = :name', db, { id: 1, name: 'Bob' });
    expect(result.success).toBe(true);
    expect(result.changes).toBe(2);
    // Delete remaining row with AND
    result = handleDelete('DELETE FROM users WHERE id = :id AND name = :name', db, { id: 3, name: 'Carol' });
    expect(result.success).toBe(true);
    expect(result.changes).toBe(1);
    expect(db.get('users')?.rows.length).toBe(1); // only schema row remains
  });
});
