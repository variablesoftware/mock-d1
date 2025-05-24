/**
 * Summarize large string values for logging (engine-wide).
 * Strings >8 chars: [str:<len>]<first 2 chars>..<last 2 chars>
 * Arrays: [array:<len>]
 * Objects: [object] (unless plain row, then summarize recursively)
 */
export function summarizeValue(val: unknown): unknown {
  if (typeof val === 'string' && val.length > 8) {
    return `[str:${val.length}]${val.slice(0, 2)}..${val.slice(-2)}`;
  }
  if (Array.isArray(val)) {
    return `[array:${val.length}]`;
  }
  if (val && typeof val === 'object') {
    if (Object.getPrototypeOf(val) === Object.prototype) {
      return summarizeRow(val as Record<string, unknown>);
    }
    return '[object]';
  }
  return val;
}

/**
 * Summarize all values in a row for logging.
 */
export function summarizeRow(row: Record<string, unknown> | undefined | null): Record<string, unknown> | undefined | null {
  if (!row || typeof row !== 'object') return row;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, summarizeValue(v)]));
}
