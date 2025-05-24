// filepath: src/engine/statementHandlers/handleBatch.ts
/**
 * @file engine/statementHandlers/handleBatch.ts
 * @description Stub for D1 batch/transaction execution. Throws D1-like errors for unsupported features.
 */
import { d1Error } from '../errors.js';
import { log } from "@variablesoftware/logface";

/**
 * Handles batch execution (multiple statements in a single call).
 * D1 does not support batch execution; this always throws a D1-like error.
 */
export function handleBatch(/* statements: string[] | unknown */): never {
  log.debug("handleBatch called (not supported)");
  log.error("Batch execution is not supported by D1");
  throw d1Error('UNSUPPORTED_SQL', 'Batch execution is not supported by D1.');
}

/**
 * Handles transaction execution (BEGIN/COMMIT/ROLLBACK).
 * D1 does not support explicit transactions; this always throws a D1-like error.
 */
export function handleTransaction(/* type: 'BEGIN'|'COMMIT'|'ROLLBACK' */): never {
  log.debug("handleTransaction called (not supported)");
  log.error("Explicit transactions are not supported by D1");
  throw d1Error('UNSUPPORTED_SQL', 'Explicit transactions are not supported by D1.');
}
