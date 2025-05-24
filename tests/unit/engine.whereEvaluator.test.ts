import { describe, it, expect } from 'vitest';
import { evaluateWhereAst } from '../../src/engine/where/whereEvaluator.js';
import { parseWhereClause } from '../../src/engine/where/whereParser.js';
import { randomAlpha, randomSnake, randomInt, randomData } from '../helpers/index.js';

describe('evaluateWhereAst', () => {
  it('evaluates simple equality', () => {
    const row = { foo: 42 };
    const ast = parseWhereClause('foo = 42');
    expect(evaluateWhereAst(ast, row, {})).toBe(true);
    expect(evaluateWhereAst(ast, { foo: 41 }, {})).toBe(false);
  });

  it('evaluates quoted column and string value', () => {
    const row = { 'bar': 'baz' };
    // Use single quotes for string literal, double quotes for column
    const ast = parseWhereClause('"bar" = \'baz\'');
    expect(evaluateWhereAst(ast, row, {})).toBe(true);
    expect(evaluateWhereAst(ast, { bar: 'qux' }, {})).toBe(false);
  });

  it('evaluates bind parameter', () => {
    const row = { foo: 123 };
    const ast = parseWhereClause('foo = :val');
    expect(evaluateWhereAst(ast, row, { val: 123 })).toBe(true);
    expect(evaluateWhereAst(ast, row, { val: 456 })).toBe(false);
  });

  it('evaluates IS NULL/IS NOT NULL', () => {
    const astNull = parseWhereClause('foo IS NULL');
    expect(evaluateWhereAst(astNull, { foo: null }, {})).toBe(true);
    expect(evaluateWhereAst(astNull, { foo: undefined }, {})).toBe(true);
    expect(evaluateWhereAst(astNull, { foo: 1 }, {})).toBe(false);
    const astNotNull = parseWhereClause('foo IS NOT NULL');
    expect(evaluateWhereAst(astNotNull, { foo: 1 }, {})).toBe(true);
    expect(evaluateWhereAst(astNotNull, { foo: null }, {})).toBe(false);
  });

  it('evaluates AND/OR', () => {
    const ast = parseWhereClause('foo = 1 AND bar = 2');
    expect(evaluateWhereAst(ast, { foo: 1, bar: 2 }, {})).toBe(true);
    expect(evaluateWhereAst(ast, { foo: 1, bar: 3 }, {})).toBe(false);
    const orAst = parseWhereClause('foo = 1 OR bar = 2');
    expect(evaluateWhereAst(orAst, { foo: 1, bar: 3 }, {})).toBe(true);
    expect(evaluateWhereAst(orAst, { foo: 0, bar: 2 }, {})).toBe(true);
    expect(evaluateWhereAst(orAst, { foo: 0, bar: 0 }, {})).toBe(false);
  });

  it('handles random keys and values (helpers)', () => {
    const col = randomSnake();
    const val = Math.random() < 0.5 ? randomAlpha(6) : randomInt();
    const row = { [col]: val };
    const ast = parseWhereClause(`${col} = ${typeof val === 'string' ? '"' + val + '"' : val}`);
    expect(evaluateWhereAst(ast, row, {})).toBe(true);
    expect(evaluateWhereAst(ast, { [col]: typeof val === 'string' ? val + 'x' : (val as number) + 1 }, {})).toBe(false);
  });

  it('handles randomData rows', () => {
    const keys = [randomSnake(), randomSnake()];
    const row = randomData(keys);
    const key = keys[0];
    const val = row[key];
    const ast = parseWhereClause(`${key} = ${typeof val === 'string' ? '"' + val + '"' : val}`);
    expect(evaluateWhereAst(ast, row, {})).toBe(true);
  });

  it('treats null and undefined as equivalent for D1', () => {
    const ast = parseWhereClause('foo = null');
    expect(evaluateWhereAst(ast, { foo: null }, {})).toBe(true);
    expect(evaluateWhereAst(ast, { foo: undefined }, {})).toBe(true);
    expect(evaluateWhereAst(ast, { foo: 0 }, {})).toBe(false);
  });
});
