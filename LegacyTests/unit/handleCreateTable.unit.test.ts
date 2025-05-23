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

describe('handleCreateTable', () => {
  it('creates a table', () => {
    const db = newDb();
    const result = handleCreateTable('CREATE TABLE users (id INTEGER, name TEXT)', db);
    expect(result.success).toBe(true);
    expect(db.has('users')).toBe(true);
  });
});
