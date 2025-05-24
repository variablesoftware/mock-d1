import { describe, it, expect, vi } from 'vitest';
import { mockInject } from '../../../src/helpers/mockInject.js';
import { randomSnake, randomInt } from '../../helpers/index.js';

// Helper to temporarily set env and restore
function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const oldEnv = { ...process.env };
  Object.assign(process.env, env);
  try { fn(); } finally { process.env = oldEnv; }
}

describe('mockInject (env gates)', () => {
  it('logs a warning if not in test env', () => {
    const db = new Map();
    const tableName = randomSnake();
    const colA = randomSnake();
    const columns = [ { original: colA, name: colA, quoted: false } ];
    const row = { [colA]: randomInt() };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    withEnv({ NODE_ENV: 'production' }, () => {
      mockInject(db, tableName, columns, [row]);
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not log a warning in test env', () => {
    const db = new Map();
    const tableName = randomSnake();
    const colA = randomSnake();
    const columns = [ { original: colA, name: colA, quoted: false } ];
    const row = { [colA]: randomInt() };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    withEnv({ NODE_ENV: 'test' }, () => {
      mockInject(db, tableName, columns, [row]);
    });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs debug output if DEBUG is set', () => {
    const db = new Map();
    const tableName = randomSnake();
    const colA = randomSnake();
    const columns = [ { original: colA, name: colA, quoted: false } ];
    const row = { [colA]: randomInt() };
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    withEnv({ DEBUG: '1' }, () => {
      mockInject(db, tableName, columns, [row]);
    });
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
  });
});
