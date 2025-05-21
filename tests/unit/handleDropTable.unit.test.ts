import { describe, it, expect } from 'vitest';
import { handleDropTable } from '../../src/engine/statementHandlers/handleDropTable';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('handleDropTable', () => {
  it('drops a table', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    const result = handleDropTable('DROP TABLE users', db);
    expect(result.success).toBe(true);
    expect(db.has('users')).toBe(false);
  });
});
