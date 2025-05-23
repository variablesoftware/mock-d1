/**
 * @file engine/resultMeta.ts
 * @description Centralized meta field calculation for D1 mock results.
 */

/**
 * Creates a meta object for a D1 result.
 * @param opts - Partial meta fields to override.
 * @returns Meta object for D1 result.
 */
export function makeMetaFields(opts: Partial<{
  duration: number;
  size_after: number;
  rows_read: number;
  rows_written: number;
  last_row_id: number;
  changed_db: boolean;
  changes: number;
}> = {}) {
  return {
    duration: opts.duration ?? 0,
    size_after: opts.size_after ?? 0,
    rows_read: opts.rows_read ?? 0,
    rows_written: opts.rows_written ?? 0,
    last_row_id: opts.last_row_id ?? 0,
    changed_db: opts.changed_db ?? false,
    changes: opts.changes ?? 0,
  };
}
