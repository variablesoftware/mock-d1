// Unit tests for parseCreateTable()
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { describe, it, expect } from 'vitest';
// Import the function via require to bypass TypeScript export restrictions
const { mockD1Database } = require('../../src/index');

// Helper to extract parseCreateTable from the mockD1Database closure
function getParseCreateTable() {
  let fn;
  // Patch the function to expose parseCreateTable
  const original = mockD1Database.toString();
  const match = original.match(/function parseCreateTable\(sql: string\) {([\s\S]*?)}\n/);
  if (!match) throw new Error('parseCreateTable not found');
  // eslint-disable-next-line no-new-func
  fn = new Function('sql', match[1] + '}');
  return fn;
}

const parseCreateTable = getParseCreateTable();

describe('parseCreateTable', () => {
  it('parses valid CREATE TABLE with single column', () => {
    expect(() => parseCreateTable('CREATE TABLE test (id)')).not.toThrow();
  });

  it('parses valid CREATE TABLE with multiple columns', () => {
    expect(() => parseCreateTable('CREATE TABLE users (id, name, email)')).not.toThrow();
  });

  it('parses with whitespace and mixed case', () => {
    expect(() => parseCreateTable('CREATE   TABLE   FooBar   (  col1  ,  col2  )')).not.toThrow();
  });

  it('throws on empty columns', () => {
    expect(() => parseCreateTable('CREATE TABLE test ()')).toThrow('at least one column');
  });

  it('throws on only whitespace in columns', () => {
    expect(() => parseCreateTable('CREATE TABLE test (   )')).toThrow('at least one column');
  });

  it('throws on malformed SQL (missing parens)', () => {
    expect(() => parseCreateTable('CREATE TABLE test id, name')).toThrow('Malformed');
  });

  it('throws on trailing comma', () => {
    expect(() => parseCreateTable('CREATE TABLE test (id, name, )')).toThrow('at least one column');
  });

  it('throws on leading comma', () => {
    expect(() => parseCreateTable('CREATE TABLE test (, id, name)')).toThrow('at least one column');
  });

  it('throws on double comma', () => {
    expect(() => parseCreateTable('CREATE TABLE test (id,,name)')).toThrow('at least one column');
  });

  it('parses columns with underscores and numbers', () => {
    expect(() => parseCreateTable('CREATE TABLE t (_id1, col_2, col3)')).not.toThrow();
  });

  it('parses reserved word as column name', () => {
    expect(() => parseCreateTable('CREATE TABLE t (select, from, where)')).not.toThrow();
  });

  it('throws on missing table name', () => {
    expect(() => parseCreateTable('CREATE TABLE (id, name)')).toThrow('Malformed');
  });

  it('throws on missing columns section', () => {
    expect(() => parseCreateTable('CREATE TABLE test')).toThrow('Malformed');
  });
});
