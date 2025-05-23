import { describe, it, expect } from 'vitest';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable';
import { handleInsert } from '../../src/engine/statementHandlers/handleInsert';
import { handleSelect } from '../../src/engine/statementHandlers/handleSelect';

function newDb() {
  return new Map<string, { rows: any[] }>();
}

describe('Performance/Stress', () => {
  it('handles large number of rows', () => {
    const db = newDb();
    handleCreateTable('CREATE TABLE users (id INTEGER)', db);
    for (let i = 0; i < 1000; i++) {
      handleInsert('INSERT INTO users (id) VALUES (:id)', db, { id: i });
    }
    const result = handleSelect('SELECT * FROM users', db, {}, 'all');
    expect(result.results.length).toBe(1000);
  });
});
