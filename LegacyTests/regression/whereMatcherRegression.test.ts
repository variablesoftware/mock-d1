// Regression tests for whereMatcher and previously fixed bugs
import { describe, it, expect } from "vitest";
import { evaluateWhereClause } from "../../src/engine/where/evaluateWhereClause";

describe("whereMatcher regression", () => {
  it("should trim whitespace in column names", () => {
    const row = { status: "active" };
    expect(evaluateWhereClause(row, "status = 'active'", {})).toBe(true);
    expect(evaluateWhereClause(row, "status   =   'active'", {})).toBe(true);
    expect(evaluateWhereClause(row, "status   =   'inactive'", {})).toBe(false);
    expect(evaluateWhereClause(row, "status   =   'active'   ", {})).toBe(true);
  });

  it("should handle quoted identifiers and case-insensitivity", () => {
    const row = { Name: "Alice" };
    expect(evaluateWhereClause(row, '"Name" = "Alice"', {})).toBe(true);
    expect(evaluateWhereClause(row, 'name = "Alice"', {})).toBe(true);
    expect(evaluateWhereClause(row, 'NAME = "Alice"', {})).toBe(true);
  });

  it("should not match on missing columns", () => {
    const row = { foo: 1 };
    expect(evaluateWhereClause(row, "bar = 1", {})).toBe(false);
  });

  it("should handle booleans, numbers, and nulls as literals", () => {
    const row = { flag: true, num: 5, nothing: null };
    expect(evaluateWhereClause(row, "flag = true", {})).toBe(true);
    expect(evaluateWhereClause(row, "num = 5", {})).toBe(true);
    expect(evaluateWhereClause(row, "num = 6", {})).toBe(false);
    expect(evaluateWhereClause(row, "nothing IS NULL", {})).toBe(true);
    expect(evaluateWhereClause(row, "nothing IS NOT NULL", {})).toBe(false);
  });

  it("should handle bind parameters and reject arrays/objects as bind values", () => {
    const row = { foo: 1 };
    expect(evaluateWhereClause(row, "foo = :val", { val: 1 })).toBe(true);
    expect(evaluateWhereClause(row, "foo = :val", { val: 2 })).toBe(false);
    expect(() => evaluateWhereClause(row, "foo = :val", { val: [1,2] })).toThrow();
    expect(() => evaluateWhereClause(row, "foo = :val", { val: { a: 1 } })).toThrow();
  });

  it("should handle IS NULL and IS NOT NULL with undefined", () => {
    const row = { foo: undefined };
    expect(evaluateWhereClause(row, "foo IS NULL", {})).toBe(true);
    expect(evaluateWhereClause(row, "foo IS NOT NULL", {})).toBe(false);
  });

  it("should handle deeply nested parentheses and large OR chains", () => {
    const row = { a: 42 };
    const orClause = Array.from({ length: 100 }, (_, i) => `a = ${i}`).join(" OR ") + " OR a = 42";
    expect(evaluateWhereClause(row, orClause, {})).toBe(true);
    let clause = "a = 1";
    for (let i = 0; i < 20; i++) clause = `(${clause})`;
    expect(evaluateWhereClause({ a: 1 }, clause, {})).toBe(true);
  });

  it("should handle string literals with spaces and quotes", () => {
    const row = { note: "hello world" };
    expect(evaluateWhereClause(row, "note = 'hello world'", {})).toBe(true);
    expect(evaluateWhereClause(row, 'note = "hello world"', {})).toBe(true);
    expect(evaluateWhereClause(row, "note = 'hello'", {})).toBe(false);
  });

  it("should handle mixed AND/OR precedence and parentheses", () => {
    const row = { a: 1, b: 2, c: 3 };
    expect(evaluateWhereClause(row, "a = 1 OR b = 2 AND c = 3", {})).toBe(true); // AND binds tighter
    expect(evaluateWhereClause(row, "(a = 1 OR b = 2) AND c = 3", {})).toBe(true);
    expect(evaluateWhereClause(row, "a = 2 OR b = 2 AND c = 4", {})).toBe(false);
    expect(evaluateWhereClause(row, "a = 2 OR (b = 2 AND c = 3)", {})).toBe(true);
  });

  it("should handle columns with undefined and null equivalence", () => {
    const row = { foo: undefined, bar: null };
    expect(evaluateWhereClause(row, "foo IS NULL", {})).toBe(true);
    expect(evaluateWhereClause(row, "bar IS NULL", {})).toBe(true);
    expect(evaluateWhereClause(row, "foo = null", {})).toBe(true);
    expect(evaluateWhereClause(row, "bar = null", {})).toBe(true);
  });

  it("should handle string literal escaping (single quote)", () => {
    const row = { name: "O'Reilly" };
    expect(evaluateWhereClause(row, "name = 'O''Reilly'", {})).toBe(true);
  });

  it("should handle whitespace and case in operators", () => {
    const row = { foo: null, bar: null };
    expect(evaluateWhereClause(row, "foo IS   NOT   NULL", {})).toBe(false);
    expect(evaluateWhereClause(row, "bar is null", {})).toBe(true);
    expect(evaluateWhereClause({ flag: true }, "flag =   true", {})).toBe(true);
  });

  it("should return false for unsupported operators", () => {
    const row = { a: 5 };
    expect(evaluateWhereClause(row, "a > 1", {})).toBe(false);
    expect(evaluateWhereClause(row, "a < 10", {})).toBe(false);
    expect(evaluateWhereClause(row, "a != 5", {})).toBe(false);
    expect(evaluateWhereClause(row, "a LIKE 'foo%'", {})).toBe(false);
  });

  it("should throw on parentheses mismatch", () => {
    const row = { a: 1 };
    expect(() => evaluateWhereClause(row, "(a = 1 OR (a = 2)", {})).toThrow();
    expect(() => evaluateWhereClause(row, "a = 1)", {})).toThrow();
    expect(() => evaluateWhereClause(row, "(a = 1", {})).toThrow();
  });

  it("should throw on trailing/leading AND/OR", () => {
    const row = { a: 1 };
    expect(() => evaluateWhereClause(row, "AND a = 1", {})).toThrow();
    expect(() => evaluateWhereClause(row, "a = 1 OR", {})).toThrow();
  });

  it("should throw on empty expressions between operators", () => {
    const row = { a: 1, b: 2 };
    expect(() => evaluateWhereClause(row, "a = 1 OR  OR b = 2", {})).toThrow();
    expect(() => evaluateWhereClause(row, "a = 1 AND  AND b = 2", {})).toThrow();
  });

  it("should return false for nonexistent columns", () => {
    const row = { foo: 1 };
    expect(evaluateWhereClause(row, "bar = 1", {})).toBe(false);
  });

  it("should handle quoted identifiers with special characters", () => {
    const row = { "weird col$": "x" };
    expect(evaluateWhereClause(row, '"weird col$" = "x"', {})).toBe(true);
  });

  it("should match bind parameter names case-insensitively", () => {
    const row = { foo: 1 };
    expect(evaluateWhereClause(row, "foo = :VAL", { val: 1 })).toBe(true);
    expect(evaluateWhereClause(row, "foo = :val", { VAL: 1 })).toBe(true);
  });

  it("should handle null/undefined bind values", () => {
    const row = { foo: null };
    expect(evaluateWhereClause(row, "foo = :bar", { bar: null })).toBe(true);
    expect(evaluateWhereClause({ foo: undefined }, "foo = :bar", { bar: undefined })).toBe(true);
  });

  it("should handle multiple spaces and tabs", () => {
    const row = { foo: "bar" };
    expect(evaluateWhereClause(row, "foo\t=\t'bar'", {})).toBe(true);
    expect(evaluateWhereClause(row, "foo    =    'bar'", {})).toBe(true);
  });

  it("should distinguish boolean string vs boolean literal", () => {
    const row = { flag: true };
    expect(evaluateWhereClause(row, "flag = 'true'", {})).toBe(false);
    expect(evaluateWhereClause(row, "flag = true", {})).toBe(true);
    expect(evaluateWhereClause({ flag: "true" }, "flag = 'true'", {})).toBe(true);
    expect(evaluateWhereClause({ flag: "true" }, "flag = true", {})).toBe(false);
  });
});
