import { describe, it, expect } from 'vitest';
import { validateSQLSyntax, validateSqlOrThrow } from '../../src/engine/sqlValidation.js';

describe('validateSQLSyntax', () => {
  it('allows valid CREATE TABLE', () => {
    expect(validateSQLSyntax('CREATE TABLE foo (id INT);')).toBe(true);
    expect(validateSQLSyntax('CREATE TABLE IF NOT EXISTS foo (id INT);')).toBe(true);
    expect(validateSQLSyntax('CREATE TABLE "foo" (id INT);')).toBe(true);
    expect(validateSQLSyntax('CREATE TABLE foo;')).toBe(true);
  });

  it('rejects unsupported patterns', () => {
    expect(validateSQLSyntax('SELECT * FROM foo WHERE bar IN (1,2)')).toBe(false);
    expect(validateSQLSyntax('SELECT * FROM foo WHERE bar LIKE "baz"')).toBe(false);
    expect(validateSQLSyntax('SELECT * FROM foo WHERE bar BETWEEN 1 AND 2')).toBe(false);
    expect(validateSQLSyntax('SELECT * FROM foo WHERE bar GLOB "baz"')).toBe(false);
    expect(validateSQLSyntax('SELECT * FROM foo WHERE bar REGEXP "baz"')).toBe(false);
    expect(validateSQLSyntax('SELECT * FROM foo WHERE bar IS DISTINCT FROM 1')).toBe(false);
    expect(validateSQLSyntax('SELECT * FROM foo WHERE bar ESCAPE "baz"')).toBe(false);
  });

  it('allows other primary operations', () => {
    expect(validateSQLSyntax('INSERT INTO foo (id) VALUES (1)')).toBe(true);
    expect(validateSQLSyntax('SELECT * FROM foo')).toBe(true);
    expect(validateSQLSyntax('UPDATE foo SET id = 1')).toBe(true);
    expect(validateSQLSyntax('DELETE FROM foo')).toBe(true);
    expect(validateSQLSyntax('DROP TABLE foo')).toBe(true);
    expect(validateSQLSyntax('TRUNCATE TABLE foo')).toBe(true);
    expect(validateSQLSyntax('ALTER TABLE foo ADD COLUMN bar INT')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(validateSQLSyntax('FOOBAR')).toBe(false);
    expect(validateSQLSyntax('')).toBe(false);
    expect(validateSQLSyntax('CREATE INDEX idx ON foo (id)')).toBe(false);
  });
});

describe('validateSqlOrThrow', () => {
  it('throws on unsupported SQL', () => {
    expect(() => validateSqlOrThrow('SELECT * FROM foo WHERE bar IN (1,2)')).toThrow();
    expect(() => validateSqlOrThrow('FOOBAR')).toThrow();
  });

  it('throws on malformed SELECT', () => {
    expect(() => validateSqlOrThrow('SELECT 1')).toThrow(/MALFORMED_SELECT/);
  });
  it('throws on malformed INSERT', () => {
    expect(() => validateSqlOrThrow('INSERT INTO foo (id)')).toThrow(/MALFORMED_INSERT/);
  });
  it('throws on malformed DELETE', () => {
    expect(() => validateSqlOrThrow('DELETE foo')).toThrow(/MALFORMED_DELETE/);
  });
  it('throws on malformed UPDATE', () => {
    expect(() => validateSqlOrThrow('UPDATE foo')).toThrow(/MALFORMED_UPDATE/);
  });
  it('throws on malformed CREATE', () => {
    expect(() => validateSqlOrThrow('CREATE foo')).toThrow(/MALFORMED_CREATE/);
  });
  it('throws on malformed DROP', () => {
    expect(() => validateSqlOrThrow('DROP foo')).toThrow(/MALFORMED_DROP/);
  });
  it('throws on malformed TRUNCATE', () => {
    expect(() => validateSqlOrThrow('TRUNCATE foo')).toThrow(/MALFORMED_TRUNCATE/);
  });
  it('throws on malformed ALTER', () => {
    expect(() => validateSqlOrThrow('ALTER foo')).toThrow(/MALFORMED_ALTER/);
  });
  it('does not throw if skipMalformed is true', () => {
    expect(() => validateSqlOrThrow('SELECT 1', { skipMalformed: true })).not.toThrow();
  });
});
