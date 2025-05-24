import { describe, it, expect, vi } from 'vitest';
import { mockBatch } from '../../../src/helpers/mockBatch.js';

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const oldEnv = { ...process.env };
  Object.assign(process.env, env);
  try { fn(); } finally { process.env = oldEnv; }
}

describe('mockBatch', () => {
  it('always warns and returns empty array', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Use any[] to avoid type errors, since the stub does not use the argument
    const stmts: any[] = [{ run: vi.fn() }, { run: vi.fn() }];
    const result = await mockBatch(stmts);
    expect(warnSpy).toHaveBeenCalledWith('mockBatch() is a mock/test-only API and should not be used in production.');
    expect(result).toEqual([]);
    warnSpy.mockRestore();
  });
});
