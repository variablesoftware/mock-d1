import { describe, it, expect } from 'vitest';
import { handleAlterTableDropColumn } from '../../src/engine/statementHandlers/handleAlterTableDropColumn.js';

describe('handleAlterTableDropColumn', () => {
  it('always throws UNSUPPORTED_SQL error', () => {
    expect(() => handleAlterTableDropColumn('ALTER TABLE foo DROP COLUMN bar')).toThrow(/ALTER TABLE ... DROP COLUMN is not supported/);
  });

  it('validates SQL if provided', () => {
    // Should still throw the same error, but exercise the validation path
    expect(() => handleAlterTableDropColumn('ALTER TABLE foo DROP COLUMN bar')).toThrow();
  });

  it('works with no arguments (still throws)', () => {
    expect(() => handleAlterTableDropColumn()).toThrow();
  });
});
