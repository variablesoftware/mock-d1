// filepath: src/engine/statementHandlers/handleBatch.ts
/**
 * @file engine/statementHandlers/handleBatch.ts
 * @description Stub for D1 batch/transaction execution. Throws D1-like errors for unsupported features.
 */
import { d1Error } from '../errors.js';

/**
 * Handles batch execution (multiple statements in a single call).
 * D1 does not support batch execution; this always throws a D1-like error.
 * @throws D1Error
 */
export function handleBatch(/* statements: string[] | unknown */): never {
  throw d1Error('BATCH_NOT_SUPPORTED', 'Batch execution is not supported by D1.');
}

/**
 * Handles transaction execution (BEGIN/COMMIT/ROLLBACK).
 * D1 does not support explicit transactions; this always throws a D1-like error.
 * @throws D1Error
 */
export function handleTransaction(/* type: 'BEGIN'|'COMMIT'|'ROLLBACK' */): never {
  throw d1Error('TRANSACTION_NOT_SUPPORTED', 'Explicit transactions are not supported by D1.');
}
