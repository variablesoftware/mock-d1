import type { D1Row } from "../../types/MockD1Database";

// Utility for D1-accurate table name extraction, normalization, and lookup
// Handles quoted/unquoted/case-sensitive/SQL keyword table names

/**
 * Extracts the table name from a SQL statement for the given type.
 * Throws on malformed SQL.
 */
export function extractTableName(sql: string, statementType: string): string {
  // Remove leading/trailing whitespace and collapse spaces
  const cleaned = sql.trim().replace(/\s+/g, ' ');
  let match: RegExpMatchArray | null = null;
  switch (statementType.toUpperCase()) {
    case 'CREATE':
      // CREATE TABLE [IF NOT EXISTS] <table> ...
      match = cleaned.match(/^CREATE TABLE(?: IF NOT EXISTS)?\s+(("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+))/i);
      break;
    case 'INSERT':
      // INSERT INTO <table> ...
      match = cleaned.match(/^INSERT INTO\s+(("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+))/i);
      break;
    case 'DELETE':
      // DELETE FROM <table> ...
      match = cleaned.match(/^DELETE FROM\s+(("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+))/i);
      break;
    case 'SELECT':
      // SELECT ... FROM <table> ...
      match = cleaned.match(/FROM\s+(("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+))/i);
      break;
    case 'UPDATE':
      // UPDATE <table> SET ...
      match = cleaned.match(/^UPDATE\s+(("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+))/i);
      break;
    case 'TRUNCATE':
      // TRUNCATE TABLE <table>
      match = cleaned.match(/^TRUNCATE TABLE\s+(("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+))/i);
      break;
    case 'ALTER':
      // ALTER TABLE <table> ...
      match = cleaned.match(/^ALTER TABLE\s+(("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+))/i);
      break;
    case 'DROP':
      // DROP TABLE <table>
      match = cleaned.match(/^DROP TABLE\s+(("[^"]+"|`[^`]+`|\[[^\]]+\]|\w+))/i);
      break;
    default:
      throw new Error(`Unsupported statement type: ${statementType}`);
  }
  if (!match) {
    throw new Error(`Malformed SQL: could not extract table name after '${statementType.toLowerCase()}'`);
  }
  return match[1];
}

/**
 * Normalizes a table name for storage/lookup.
 * Quoted names are preserved as-is (case-sensitive).
 * Unquoted names are lowercased (case-insensitive).
 */
export function normalizeTableName(tableName: string): string {
  if (/^("[^"]+"|`[^`]+`|\[[^\]]+\])$/.test(tableName)) {
    // Quoted: strip quotes but preserve case and special chars
    return tableName;
  }
  // Unquoted: lower-case
  return tableName.toLowerCase();
}

/**
 * Finds the actual table key in the db map for a given table name.
 * Returns the key if found, else undefined.
 */
export function getTableKey(db: Map<string, D1Row | Record<string, unknown>>, tableName: string): string | undefined {
  // Try exact match (for quoted)
  if (db.has(tableName)) return tableName;
  // Try normalized (for unquoted)
  const norm = normalizeTableName(tableName);
  for (const key of db.keys()) {
    if (normalizeTableName(key) === norm) return key;
  }
  return undefined;
}
