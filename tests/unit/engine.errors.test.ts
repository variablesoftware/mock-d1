import { describe, it, expect } from 'vitest';
import { D1_ERRORS, d1Error } from '../../src/engine/errors.js';

describe('D1_ERRORS', () => {
  it('contains expected error codes and messages', () => {
    expect(D1_ERRORS.MALFORMED_INSERT).toBe('Malformed INSERT statement');
    expect(D1_ERRORS.MALFORMED_SELECT).toBe('Malformed SELECT statement');
    expect(D1_ERRORS.UNSUPPORTED_SQL).toBe('Unsupported SQL syntax');
    expect(D1_ERRORS.TABLE_NOT_FOUND).toBe('Table does not exist');
    expect(D1_ERRORS.COLUMN_NOT_FOUND).toBe('Column does not exist');
    expect(D1_ERRORS.INVALID_ARGUMENT).toBe('Invalid argument');
    expect(D1_ERRORS.SQL_INJECTION_ATTEMPT).toBe('Potential SQL injection detected');
    expect(D1_ERRORS.GENERIC).toBe('D1 error');
  });
});

describe('d1Error', () => {
  it('returns an Error with the correct message for a known code', () => {
    const err = d1Error('MALFORMED_INSERT');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe(D1_ERRORS.MALFORMED_INSERT);
  });

  it('appends details to the error message if provided', () => {
    const err = d1Error('UNSUPPORTED_SQL', 'LIKE not supported');
    expect(err.message).toBe('Unsupported SQL syntax: LIKE not supported');
  });

  it('throws if an unknown code is used (TypeScript type safety)', () => {
    // @ts-expect-error
    expect(() => d1Error('NOT_A_REAL_CODE')).toThrow();
  });
});
