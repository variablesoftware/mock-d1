import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockBatch } from '../../src/helpers/mockBatch.js';
import { mockDump } from '../../src/helpers/mockDump.js';
import { mockInject } from '../../src/helpers/mockInject.js';
import * as injectTableRowsModule from '../../src/helpers/mockInjectTableRows.js';
const { injectTableRows } = injectTableRowsModule;

// Mocks for prepared statements
const fakeResult = { results: [], success: true, meta: {} };
const makeStmt = () => ({ run: vi.fn().mockResolvedValue(fakeResult) });

// --- mockBatch ---
describe('mockBatch', () => {
  it('calls run on all statements and returns results', async () => {
    const stmts = [makeStmt(), makeStmt()];
    const results = await mockBatch(stmts);
    expect(stmts[0].run).toHaveBeenCalled();
    expect(stmts[1].run).toHaveBeenCalled();
    expect(results).toEqual([fakeResult, fakeResult]);
  });
});

// --- mockDump ---
describe('mockDump', () => {
  it('returns a snapshot of the db', () => {
    const db = new Map([
      ['users', { rows: [{ id: 1 }] }],
      ['posts', { rows: [{ id: 2 }] }],
    ]);
    const snapshot = mockDump(db);
    expect(snapshot).toEqual({ users: { rows: [{ id: 1 }] }, posts: { rows: [{ id: 2 }] } });
  });
});

// --- mockInject ---
describe('mockInject', () => {
  it('calls injectTableRows with correct args', () => {
    const db = new Map();
    const rows = [{ id: 1 }];
    const spy = vi.spyOn(injectTableRowsModule, 'injectTableRows');
    mockInject(db, 'users', rows);
    expect(spy).toHaveBeenCalledWith(db, 'users', rows);
    spy.mockRestore();
  });
});

// --- injectTableRows ---
describe('injectTableRows', () => {
  let db: Map<string, { rows: Record<string, unknown>[] }>;
  beforeEach(() => { db = new Map(); });

  it('creates table and schema row if not present', () => {
    injectTableRows(db, 'users', [{ id: 1, name: 'A' }]);
    expect(db.get('users')).toBeDefined();
    expect(db.get('users')!.rows[0]).toHaveProperty('id');
    expect(db.get('users')!.rows[0]).toHaveProperty('name');
  });

  it('clears rows if injected with empty array', () => {
    injectTableRows(db, 'users', [{ id: 1 }]);
    injectTableRows(db, 'users', []);
    // Now expect only the schema row remains
    expect(db.get('users')!.rows).toEqual([{ id: undefined }]);
  });

  it('replaces schema row if schema row is empty and non-empty row injected', () => {
    db.set('users', { rows: [{}] });
    expect(() => injectTableRows(db, 'users', [{ id: 1 }])).not.toThrow();
    expect(db.get('users')!.rows[0]).toHaveProperty('id');
  });

  it('merges extra columns into schema row', () => {
    injectTableRows(db, 'users', [{ id: 1 }]);
    expect(() => injectTableRows(db, 'users', [{ id: 2, extra: 3 }])).not.toThrow();
    expect(db.get('users')!.rows[0]).toHaveProperty('extra');
  });

  it('normalizes row keys case-insensitively', () => {
    injectTableRows(db, 'users', [{ ID: 1 }]);
    // The schema row will have 'ID', and the data row will match that key
    expect(db.get('users')!.rows[1]).toHaveProperty('ID', 1);
  });
});
