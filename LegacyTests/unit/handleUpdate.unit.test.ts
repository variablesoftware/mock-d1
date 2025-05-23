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

  it('throws if table does not exist (!tableKey)', () => {
    const db = newDb();
    expect(() => handleUpdate('UPDATE notfound SET name = :name WHERE id = :id', db, { id: 1, name: 'Bob' })).toThrow("Table 'notfound' does not exist in the database.");
  });

  it('throws on malformed UPDATE statement (!setMatch)', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    expect(() => handleUpdate('UPDATE users SET', db, {})).toThrow('Malformed UPDATE statement.');
  });

  it('throws if no data rows present (dataRows)', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    // No insert, so no data rows
    expect(() => handleUpdate('UPDATE users SET name = :name WHERE id = :id', db, { id: 1, name: 'Bob' })).not.toThrow();
  });

  it('throws if updating column not in schema (canonicalCols)', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    expect(() => handleUpdate('UPDATE users SET age = :age WHERE id = :id', db, { id: 1, age: 42 })).toThrow('Attempted to update column not present in schema: age');
  });

  it('throws if missing setBindKey (!setBindKey)', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    expect(() => handleUpdate('UPDATE users SET name = :name WHERE id = :id', db, { id: 1 })).toThrow('Missing bind argument: name');
  });

  it('throws if missing whereBindKey (!whereBindKey)', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    expect(() => handleUpdate('UPDATE users SET name = :name WHERE id = :id', db, { name: 'Bob' })).toThrow('Missing bind argument: id');
  });

  it('throws on unsupported data type in update (JSON.stringify fails)', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' });
    const circular: any = {};
    circular.self = circular;
    expect(() => handleUpdate('UPDATE users SET name = :name WHERE id = :id', db, { id: 1, name: circular })).toThrow('Unsupported data type');
  });
});
