import { describe, it, expect } from 'vitest';
import { parseCreateTable } from '../../src/engine/parseCreateTable.js';

describe('parseCreateTable', () => {
  it('parses valid CREATE TABLE with single column', () => {
    const sql = 'CREATE TABLE foo (id INTEGER)';
    const result = parseCreateTable(sql);
    expect(result.tableName).toBe('foo');
    expect(result.columns).toEqual(['id INTEGER']);
  });

  it('parses valid CREATE TABLE with multiple columns', () => {
    const sql = 'CREATE TABLE bar (id INTEGER, name TEXT, age INT)';
    const result = parseCreateTable(sql);
    expect(result.tableName).toBe('bar');
    expect(result.columns).toEqual(['id INTEGER', 'name TEXT', 'age INT']);
  });

  it('trims whitespace in columns', () => {
    const sql = 'CREATE TABLE baz ( id INTEGER , name TEXT )';
    const result = parseCreateTable(sql);
    expect(result.columns).toEqual(['id INTEGER', 'name TEXT']);
  });

  it('throws on missing columns', () => {
    expect(() => parseCreateTable('CREATE TABLE foo ()')).toThrow(/at least one column/);
    expect(() => parseCreateTable('CREATE TABLE foo (   )')).toThrow(/at least one column/);
  });

  it('throws on malformed CREATE TABLE', () => {
    expect(() => parseCreateTable('CREATE foo (id)')).toThrow(/Malformed/);
    expect(() => parseCreateTable('CREATE TABLE')).toThrow(/Malformed/);
    expect(() => parseCreateTable('CREATE TABLE foo')).toThrow(/Malformed/);
  });

  it('throws on empty or invalid column definitions', () => {
    expect(() => parseCreateTable('CREATE TABLE foo (,)')).toThrow(/at least one column/);
    expect(() => parseCreateTable('CREATE TABLE foo (,id INTEGER)')).toThrow(/at least one column/);
    expect(() => parseCreateTable('CREATE TABLE foo (id INTEGER,,name TEXT)')).toThrow(/at least one column/);
    expect(() => parseCreateTable('CREATE TABLE foo (id INTEGER,)')).toThrow(/at least one column/);
  });
});
