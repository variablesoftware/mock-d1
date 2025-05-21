import { describe, it, expect } from 'vitest';
import { validateSQLSyntax } from '../../../src/engine/sqlValidation';

/**
 * Unit tests for validateSQLSyntax
 */
describe('validateSQLSyntax', () => {
  it('returns true for supported SQL commands', () => {
    const supported = [
      'CREATE TABLE test (id INT)',
      'INSERT INTO test VALUES (1)',
      'SELECT * FROM test',
      'UPDATE test SET id = 2',
      'DELETE FROM test WHERE id = 1',
      'DROP TABLE test',
      'TRUNCATE TABLE test',
      'ALTER TABLE test ADD COLUMN name TEXT',
    ];
    for (const sql of supported) {
      expect(validateSQLSyntax(sql)).toBe(true);
    }
  });

  it('returns false for unsupported SQL commands', () => {
    const unsupported = [
      'PRAGMA table_info(test)',
      'BEGIN TRANSACTION',
      'COMMIT',
      'ROLLBACK',
      'EXPLAIN SELECT * FROM test',
      'WITH cte AS (SELECT 1) SELECT * FROM cte',
      '',
      '   ',
      'RANDOMCOMMAND test',
    ];
    for (const sql of unsupported) {
      expect(validateSQLSyntax(sql)).toBe(false);
    }
  });

  it('trims whitespace before checking', () => {
    expect(validateSQLSyntax('   SELECT * FROM test')).toBe(true);
    expect(validateSQLSyntax('\n\tINSERT INTO test VALUES (1)')).toBe(true);
  });
});
