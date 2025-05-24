import { describe, it, expect } from 'vitest';
import { parseWhereClause, type WhereAstNode } from '../../../src/engine/where/whereParser.js';


describe('parseWhereClause', () => {
  it('parses simple equality', () => {
    const ast = parseWhereClause('foo = 1');
    expect(ast).toEqual({ type: 'comparison', column: 'foo', operator: '=', value: '1' });
  });

  it('parses quoted column and string value', () => {
    const ast = parseWhereClause('"bar" = "baz"');
    expect(ast).toEqual({ type: 'comparison', column: '"bar"', operator: '=', value: '"baz"' });
  });

  it('parses bind parameter', () => {
    const ast = parseWhereClause('foo = :val');
    expect(ast).toEqual({ type: 'comparison', column: 'foo', operator: '=', value: ':val' });
  });

  it('parses IS NULL', () => {
    const ast = parseWhereClause('foo IS NULL');
    expect(ast).toEqual({ type: 'isNull', column: 'foo', not: false });
  });

  it('parses IS NOT NULL', () => {
    const ast = parseWhereClause('foo IS NOT NULL');
    expect(ast).toEqual({ type: 'isNull', column: 'foo', not: true });
  });

  it('parses AND/OR expressions', () => {
    const ast = parseWhereClause('foo = 1 AND bar = 2');
    expect(ast).toEqual({
      type: 'and',
      left: { type: 'comparison', column: 'foo', operator: '=', value: '1' },
      right: { type: 'comparison', column: 'bar', operator: '=', value: '2' },
    });
    const orAst = parseWhereClause('foo = 1 OR bar = 2');
    expect(orAst).toEqual({
      type: 'or',
      left: { type: 'comparison', column: 'foo', operator: '=', value: '1' },
      right: { type: 'comparison', column: 'bar', operator: '=', value: '2' },
    });
  });

  it('parses nested parentheses', () => {
    const ast = parseWhereClause('(foo = 1)');
    expect(ast).toEqual({ type: 'comparison', column: 'foo', operator: '=', value: '1' });
    const nested = parseWhereClause('((foo = 1))');
    expect(nested).toEqual({ type: 'comparison', column: 'foo', operator: '=', value: '1' });
  });

  it('throws on unsupported operators', () => {
    expect(() => parseWhereClause('foo IN (1,2)')).toThrow();
    expect(() => parseWhereClause('foo LIKE "bar"')).toThrow();
    expect(() => parseWhereClause('foo BETWEEN 1 AND 2')).toThrow();
  });

  it('throws on malformed or incomplete clauses', () => {
    expect(() => parseWhereClause('')).toThrow();
    expect(() => parseWhereClause('AND')).toThrow();
    expect(() => parseWhereClause('foo =')).toThrow();
    expect(() => parseWhereClause('foo = 1 OR')).toThrow();
    expect(() => parseWhereClause('(')).toThrow();
  });

  it('throws on too deeply nested parentheses', () => {
    let clause = 'a = 1';
    for (let i = 0; i < 22; i++) clause = `(${clause})`;
    expect(() => parseWhereClause(clause)).toThrow();
  });
});

function randomKey() {
  return Math.random().toString(36).slice(2, 10);
}
function randomVal() {
  return Math.random() > 0.5 ? Math.random().toString(36).slice(2, 8) : Math.floor(Math.random() * 1000);
}

describe('parseWhereClause (randomized)', () => {
  it('parses random equality', () => {
    const col = randomKey();
    const val = randomVal();
    const ast = parseWhereClause(`${col} = ${typeof val === 'string' ? '"' + val + '"' : val}`);
    expect(ast).toEqual({ type: 'comparison', column: col, operator: '=', value: typeof val === 'string' ? `"${val}"` : String(val) });
  });

  it('parses random bind parameter', () => {
    const col = randomKey();
    const bind = randomKey();
    const ast = parseWhereClause(`${col} = :${bind}`);
    expect(ast).toEqual({ type: 'comparison', column: col, operator: '=', value: `:${bind}` });
  });

  it('parses random IS NULL/IS NOT NULL', () => {
    const col = randomKey();
    expect(parseWhereClause(`${col} IS NULL`)).toEqual({ type: 'isNull', column: col, not: false });
    expect(parseWhereClause(`${col} IS NOT NULL`)).toEqual({ type: 'isNull', column: col, not: true });
  });

  it('parses random AND/OR', () => {
    const col1 = randomKey();
    const col2 = randomKey();
    const val1 = randomVal();
    const val2 = randomVal();
    const ast = parseWhereClause(`${col1} = ${typeof val1 === 'string' ? '"' + val1 + '"' : val1} AND ${col2} = ${typeof val2 === 'string' ? '"' + val2 + '"' : val2}`);
    expect(ast.type).toBe('and');
    expect(ast.left.type).toBe('comparison');
    expect(ast.right.type).toBe('comparison');
  });
});
