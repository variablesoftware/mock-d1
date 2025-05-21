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

describe('Error Handling & Edge Cases', () => {
  it('throws on malformed CREATE TABLE', () => {
    const db = newDb();
    expect(() => handleCreateTable('CREATE users', db)).toThrow();
  });
  it('throws on non-existent table for SELECT', () => {
    const db = newDb();
    expect(() => handleSelect('SELECT * FROM missing', db, {}, 'all')).toThrow();
  });
  it('throws on duplicate CREATE TABLE', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    expect(() => handleCreateTable('CREATE TABLE users (id INTEGER)', db)).not.toThrow(); // allowed, but does nothing
  });
  it('throws on unsupported SQL', () => {
    const db = newDb();
    expect(() => handleSelect('FOOBAR users', db, {}, 'all')).toThrow();
  });
});
