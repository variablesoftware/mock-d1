import { describe, it, expect } from 'vitest';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';
import { handleDelete } from '../../src/engine/statementHandlers/handleDelete';
import { handleUpdate } from '../../src/engine/statementHandlers/handleUpdate';
import { handleDropTable } from '../../src/engine/statementHandlers/handleDropTable';
import { handleTruncateTable } from '../../src/engine/statementHandlers/handleTruncateTable';
import { handleAlterTableAddColumn } from '../../src/engine/statementHandlers/handleAlterTableAddColumn';
import { handleSelect } from '../../src/engine/statementHandlers/handleSelect';
import { mockD1Database } from '../../src/mockD1Database';

// Helper to create a new in-memory DB
function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('Statement Handlers', () => {
  it('handleCreateTable creates a table', () => {
    const db = newDb();
    const result = handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    expect(result.success).toBe(true);
    expect(db.has('users')).toBe(true);
  });

  it('handleInsert inserts a row', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    const result = handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    expect(result.success).toBe(true);
    expect(db.get('users')?.rows.length).toBeGreaterThan(1);
  });

  it('handleDelete deletes a row', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    const result = handleDelete('DELETE FROM users WHERE id = :id', db, { id: 1 });
    expect(result.success).toBe(true);
  });

  it('handleUpdate updates a row', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    const result = handleUpdate('UPDATE users SET name = :name WHERE id = :id', db, { id: 1, name: 'Bob' });
    expect(result.success).toBe(true);
  });

  it('handleDropTable drops a table', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    const result = handleDropTable('DROP TABLE users', db);
    expect(result.success).toBe(true);
    expect(db.has('users')).toBe(false);
  });

  it('handleTruncateTable truncates a table', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: 1 });
    const result = handleTruncateTable('TRUNCATE TABLE users', db);
    expect(result.success).toBe(true);
    expect(db.get('users')?.rows.length).toBe(0);
  });

  it('handleAlterTableAddColumn adds a column', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    const result = handleAlterTableAddColumn('ALTER TABLE users ADD COLUMN age INTEGER', db);
    expect(result.success).toBe(true);
    expect(Object.keys(db.get('users')?.rows[0] || {})).toContain('age');
  });

  it('handleSelect selects rows', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    const result = handleSelect('SELECT * FROM users', db, {}, 'all');
    expect(result.success).toBe(true);
    expect(Array.isArray(result.results)).toBe(true);
  });
});

describe('mockD1Database helpers', () => {
  it('inject adds rows to a table (coverage)', () => {
    const db = mockD1Database();
    db.inject('users', [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]);
    const snapshot = db.dump();
    expect(snapshot.users).toBeDefined();
    expect(snapshot.users.rows.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.users.rows.some(r => r.id === 1 && r.name === 'Alice')).toBe(true);
    expect(snapshot.users.rows.some(r => r.id === 2 && r.name === 'Bob')).toBe(true);
  });

  it('inject clears rows when given an empty array', () => {
    const db = mockD1Database();
    db.inject('users', [ { id: 1, name: 'Alice' } ]);
    db.inject('users', []);
    const snapshot = db.dump();
    expect(snapshot.users.rows.length).toBe(0);
  });
});
