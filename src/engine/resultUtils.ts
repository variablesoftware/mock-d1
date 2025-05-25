/**
 * @file engine/resultUtils.ts
 * @description Formats the result object to match D1's expected shape.
 */
import { makeMetaFields } from './resultMeta.js';

/**
 * Formats a D1 result object.
 * @param results - The result rows.
 * @param meta - Optional meta fields.
 * @returns D1 result object.
 */
export function makeD1Result<T = unknown>(results: T[], meta?: Partial<ReturnType<typeof makeMetaFields>> & Record<string, unknown>): { results: T[]; success: boolean; meta: ReturnType<typeof makeMetaFields> & Record<string, unknown> } {
  const stdMeta = makeMetaFields(meta);
  // Merge any extra fields from meta (e.g., rowCount, lastRowId) into the meta object
  const extra = meta ? Object.fromEntries(Object.entries(meta).filter(([k]) => !(k in stdMeta))) : {};
  return {
    results,
    success: true,
    meta: { ...stdMeta, ...extra },
  };
}
