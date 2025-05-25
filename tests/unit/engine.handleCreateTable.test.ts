import { describe, it, expect, beforeEach } from 'vitest';
import { handleCreateTable } from '../../src/engine/statementHandlers/handleCreateTable.js';
import { randomSnake } from '../helpers/index.js';

describe('handleCreateTable', () => {
  let db;
  let tableName;
  let colA, colB;

  beforeEach(() => {
    db = new Map();
    tableName = randomSnake();
    colA = randomSnake();
    colB = randomSnake();
  });

  it('creates a table with columns', () => {
    const sql = `CREATE TABLE ${tableName} (${colA} TEXT, ${colB} INT)`;
    const result = handleCreateTable(sql, db);
    expect(result.success).toBe(true);
    expect(db.has(tableName.toLowerCase()) || db.has(tableName)).toBe(true);
    const table = db.get(tableName.toLowerCase()) || db.get(tableName);
    expect(table.columns.length).toBe(2);
    expect(table.rows.length).toBe(0);
  });

  it('creates a table with quoted columns', () => {
    const sql = `CREATE TABLE ${tableName} ("${colA}" TEXT, "${colB}" INT)`;
    const result = handleCreateTable(sql, db);
    expect(result.success).toBe(true);
    const table = db.get(tableName.toLowerCase()) || db.get(tableName);
    expect(table.columns[0].quoted).toBe(true);
    expect(table.columns[1].quoted).toBe(true);
  });

  it('creates an empty table if no columns', () => {
    const sql = `CREATE TABLE ${tableName}`;
    const result = handleCreateTable(sql, db);
    expect(result.success).toBe(true);
    const table = db.get(tableName.toLowerCase()) || db.get(tableName);
    expect(table.columns.length).toBe(0);
    expect(table.rows.length).toBe(0);
  });

  it('throws on duplicate columns', () => {
    const sql = `CREATE TABLE ${tableName} (${colA} TEXT, ${colA} INT)`;
    expect(() => handleCreateTable(sql, db)).toThrow();
    const sql2 = `CREATE TABLE ${tableName} ("${colA}" TEXT, "${colA}" INT)`;
    expect(() => handleCreateTable(sql2, db)).toThrow();
  });

  it('allows empty parens (no columns) and creates an empty table', () => {
    const sql = `CREATE TABLE ${tableName} ()`;
    const result = handleCreateTable(sql, db);
    expect(result && typeof result === 'object' && 'success' in result).toBe(true);
    const table = db.get(tableName.toLowerCase()) || db.get(tableName);
    expect(table.columns.length).toBe(0);
    expect(table.rows.length).toBe(0);
  });

  it('throws on malformed SQL', () => {
    expect(() => handleCreateTable('CREATE', db)).toThrow();
    expect(() => handleCreateTable('CREATE TABLE', db)).toThrow();
  });

  it('skips creation if table exists and IF NOT EXISTS is present', () => {
    const sql = `CREATE TABLE ${tableName} (${colA} TEXT)`;
    handleCreateTable(sql, db);
    const sql2 = `CREATE TABLE IF NOT EXISTS ${tableName} (${colA} TEXT)`;
    const result = handleCreateTable(sql2, db);
    expect(result.success).toBe(true);
    expect(result.meta.changed_db).toBe(false);
  });

  it('throws if table exists and IF NOT EXISTS is not present', () => {
    const sql = `CREATE TABLE ${tableName} (${colA} TEXT)`;
    handleCreateTable(sql, db);
    expect(() => handleCreateTable(sql, db)).toThrow();
  });
});
