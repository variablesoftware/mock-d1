import { describe, it, expect } from 'vitest';
import { handleTruncateTable } from '../../src/engine/statementHandlers/handleTruncateTable';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('handleTruncateTable', () => {
  it('truncates a table', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: 1 });
    const result = handleTruncateTable('TRUNCATE TABLE users', db);
    expect(result.success).toBe(true);
    expect(db.get('users')?.rows.length).toBe(0);
  });
});
