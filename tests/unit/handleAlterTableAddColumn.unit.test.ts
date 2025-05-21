import { describe, it, expect } from 'vitest';
import { handleAlterTableAddColumn } from '../../src/engine/statementHandlers/handleAlterTableAddColumn';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('handleAlterTableAddColumn', () => {
  it('adds a column', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    const result = handleAlterTableAddColumn('ALTER TABLE users ADD COLUMN age INTEGER', db);
    expect(result.success).toBe(true);
    expect(Object.keys(db.get('users')?.rows[0] || {})).toContain('age');
  });
});
