import { describe, it, expect } from 'vitest';
import { handleBatch, handleTransaction } from '../../src/engine/statementHandlers/handleBatch.js';

describe('handleBatch', () => {
  it('always throws UNSUPPORTED_SQL error', () => {
    expect(() => handleBatch()).toThrow(/Batch execution is not supported by D1/);
  });
});

describe('handleTransaction', () => {
  it('always throws UNSUPPORTED_SQL error', () => {
    expect(() => handleTransaction()).toThrow(/Explicit transactions are not supported by D1/);
  });
});
