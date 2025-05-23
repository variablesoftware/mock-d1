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

  it('throws on malformed DROP TABLE statement', () => {
    expect(() => handleDropTable('DROP TABLE', newDb())).toThrow('Malformed DROP TABLE statement.');
    expect(() => handleDropTable('drop table', newDb())).toThrow('Malformed DROP TABLE statement.');
    expect(() => handleDropTable('drop', newDb())).toThrow();
    expect(() => handleDropTable('drop table ', newDb())).toThrow();
  });

  it('throws if table does not exist', () => {
    expect(() => handleDropTable('DROP TABLE notfound', newDb())).toThrow("Table 'notfound' does not exist in the database.");
  });
});
