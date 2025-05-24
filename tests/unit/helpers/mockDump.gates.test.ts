import { describe, it, expect, vi } from 'vitest';
import { mockDump } from '../../../src/helpers/mockDump.js';
import { randomSnake, randomInt } from '../../helpers/index.js';

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const oldEnv = { ...process.env };
  Object.assign(process.env, env);
  try { fn(); } finally { process.env = oldEnv; }
}

describe('mockDump (env gates)', () => {
  it('logs a warning if not in test env', () => {
    const db = new Map();
    const tableName = randomSnake();
    db.set(tableName, { columns: [], rows: [] });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    withEnv({ NODE_ENV: 'production' }, () => {
      mockDump(db);
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not log a warning in test env', () => {
    const db = new Map();
    const tableName = randomSnake();
    db.set(tableName, { columns: [], rows: [] });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    withEnv({ NODE_ENV: 'test' }, () => {
      mockDump(db);
    });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs debug output if DEBUG is set', () => {
    const db = new Map();
    const tableName = randomSnake();
    db.set(tableName, { columns: [], rows: [] });
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    withEnv({ DEBUG: '1' }, () => {
      mockDump(db);
    });
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
  });
});
