import { describe, it, expect } from 'vitest';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';
import { handleDelete } from '../../src/engine/statementHandlers/handleDelete';
import { handleUpdate } from '../../src/engine/statementHandlers/handleUpdate';
import { handleDropTable } from '../../src/engine/statementHandlers/handleDropTable';
import { handleTruncateTable } from '../../src/engine/statementHandlers/handleTruncateTable';
import { handleAlterTableAddColumn } from '../../src/engine/statementHandlers/handleAlterTableAddColumn';
import { handleSelect } from '../../src/engine/statementHandlers/handleSelect';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('Statement Handlers (integration)', () => {
  it('can create, insert, update, select, delete, drop, truncate, and alter', () => {
    const db = newDb();
    expect(handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db).success).toBe(true);
    expect(handleInsert('INSERT INTO users (id, name) VALUES (:id, :name)', db, { id: 1, name: 'Alice' }).success).toBe(true);
    expect(handleUpdate('UPDATE users SET name = :name WHERE id = :id', db, { id: 1, name: 'Bob' }).success).toBe(true);
    expect(handleSelect('SELECT * FROM users', db, {}, 'all').success).toBe(true);
    expect(handleDelete('DELETE FROM users WHERE id = :id', db, { id: 1 }).success).toBe(true);
    expect(handleTruncateTable('TRUNCATE TABLE users', db).success).toBe(true);
    expect(handleAlterTableAddColumn('ALTER TABLE users ADD COLUMN age INTEGER', db).success).toBe(true);
    expect(handleDropTable('DROP TABLE users', db).success).toBe(true);
  });
});
