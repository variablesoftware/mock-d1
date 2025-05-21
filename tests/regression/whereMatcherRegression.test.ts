// Regression tests for whereMatcher and previously fixed bugs
import { describe, it, expect } from "vitest";
import { matchesWhere } from "../../src/engine/whereMatcher";

describe("whereMatcher regression", () => {
  it("should trim whitespace in column names", () => {
    const row = { status: "active" };
    expect(matchesWhere(row, "status = 'active'", {})).toBe(true);
    expect(matchesWhere(row, "status   =   'active'", {})).toBe(true);
    expect(matchesWhere(row, "status   =   'inactive'", {})).toBe(false);
    expect(matchesWhere(row, "status   =   'active'   ", {})).toBe(true);
  });

  it("should handle quoted identifiers and case-insensitivity", () => {
    const row = { Name: "Alice" };
    expect(matchesWhere(row, '"Name" = "Alice"', {})).toBe(true);
    expect(matchesWhere(row, 'name = "Alice"', {})).toBe(true);
    expect(matchesWhere(row, 'NAME = "Alice"', {})).toBe(true);
  });

  it("should not match on missing columns", () => {
    const row = { foo: 1 };
    expect(matchesWhere(row, "bar = 1", {})).toBe(false);
  });

  it("should handle booleans, numbers, and nulls as literals", () => {
    const row = { flag: true, num: 5, nothing: null };
    expect(matchesWhere(row, "flag = true", {})).toBe(true);
    expect(matchesWhere(row, "num = 5", {})).toBe(true);
    expect(matchesWhere(row, "num = 6", {})).toBe(false);
    expect(matchesWhere(row, "nothing IS NULL", {})).toBe(true);
    expect(matchesWhere(row, "nothing IS NOT NULL", {})).toBe(false);
  });

  it("should handle bind parameters and reject arrays/objects as bind values", () => {
    const row = { foo: 1 };
    expect(matchesWhere(row, "foo = :val", { val: 1 })).toBe(true);
    expect(matchesWhere(row, "foo = :val", { val: 2 })).toBe(false);
    expect(() => matchesWhere(row, "foo = :val", { val: [1,2] })).toThrow();
    expect(() => matchesWhere(row, "foo = :val", { val: { a: 1 } })).toThrow();
  });

  it("should handle IS NULL and IS NOT NULL with undefined", () => {
    const row = { foo: undefined };
    expect(matchesWhere(row, "foo IS NULL", {})).toBe(true);
    expect(matchesWhere(row, "foo IS NOT NULL", {})).toBe(false);
  });

  it("should handle deeply nested parentheses and large OR chains", () => {
    const row = { a: 42 };
    const orClause = Array.from({ length: 100 }, (_, i) => `a = ${i}`).join(" OR ") + " OR a = 42";
    expect(matchesWhere(row, orClause, {})).toBe(true);
    let clause = "a = 1";
    for (let i = 0; i < 20; i++) clause = `(${clause})`;
    expect(matchesWhere({ a: 1 }, clause, {})).toBe(true);
  });

  it("should handle string literals with spaces and quotes", () => {
    const row = { note: "hello world" };
    expect(matchesWhere(row, "note = 'hello world'", {})).toBe(true);
    expect(matchesWhere(row, 'note = "hello world"', {})).toBe(true);
    expect(matchesWhere(row, "note = 'hello'", {})).toBe(false);
  });

  it("should handle mixed AND/OR precedence and parentheses", () => {
    const row = { a: 1, b: 2, c: 3 };
    expect(matchesWhere(row, "a = 1 OR b = 2 AND c = 3", {})).toBe(true); // AND binds tighter
    expect(matchesWhere(row, "(a = 1 OR b = 2) AND c = 3", {})).toBe(true);
    expect(matchesWhere(row, "a = 2 OR b = 2 AND c = 4", {})).toBe(false);
    expect(matchesWhere(row, "a = 2 OR (b = 2 AND c = 3)", {})).toBe(true);
  });

  it("should handle columns with undefined and null equivalence", () => {
    const row = { foo: undefined, bar: null };
    expect(matchesWhere(row, "foo IS NULL", {})).toBe(true);
    expect(matchesWhere(row, "bar IS NULL", {})).toBe(true);
    expect(matchesWhere(row, "foo = null", {})).toBe(true);
    expect(matchesWhere(row, "bar = null", {})).toBe(true);
  });

  it("should handle string literal escaping (single quote)", () => {
    const row = { name: "O'Reilly" };
    expect(matchesWhere(row, "name = 'O''Reilly'", {})).toBe(true);
  });

  it("should handle whitespace and case in operators", () => {
    const row = { foo: null, bar: null };
    expect(matchesWhere(row, "foo IS   NOT   NULL", {})).toBe(false);
    expect(matchesWhere(row, "bar is null", {})).toBe(true);
    expect(matchesWhere({ flag: true }, "flag =   true", {})).toBe(true);
  });

  it("should return false for unsupported operators", () => {
    const row = { a: 5 };
    expect(matchesWhere(row, "a > 1", {})).toBe(false);
    expect(matchesWhere(row, "a < 10", {})).toBe(false);
    expect(matchesWhere(row, "a != 5", {})).toBe(false);
    expect(matchesWhere(row, "a LIKE 'foo%'", {})).toBe(false);
  });

  it("should throw on parentheses mismatch", () => {
    const row = { a: 1 };
    expect(() => matchesWhere(row, "(a = 1 OR (a = 2)", {})).toThrow();
    expect(() => matchesWhere(row, "a = 1)", {})).toThrow();
    expect(() => matchesWhere(row, "(a = 1", {})).toThrow();
  });

  it("should throw on trailing/leading AND/OR", () => {
    const row = { a: 1 };
    expect(() => matchesWhere(row, "AND a = 1", {})).toThrow();
    expect(() => matchesWhere(row, "a = 1 OR", {})).toThrow();
  });

  it("should throw on empty expressions between operators", () => {
    const row = { a: 1, b: 2 };
    expect(() => matchesWhere(row, "a = 1 OR  OR b = 2", {})).toThrow();
    expect(() => matchesWhere(row, "a = 1 AND  AND b = 2", {})).toThrow();
  });

  it("should return false for nonexistent columns", () => {
    const row = { foo: 1 };
    expect(matchesWhere(row, "bar = 1", {})).toBe(false);
  });

  it("should handle quoted identifiers with special characters", () => {
    const row = { "weird col$": "x" };
    expect(matchesWhere(row, '"weird col$" = "x"', {})).toBe(true);
  });

  it("should match bind parameter names case-insensitively", () => {
    const row = { foo: 1 };
    expect(matchesWhere(row, "foo = :VAL", { val: 1 })).toBe(true);
    expect(matchesWhere(row, "foo = :val", { VAL: 1 })).toBe(true);
  });

  it("should handle null/undefined bind values", () => {
    const row = { foo: null };
    expect(matchesWhere(row, "foo = :bar", { bar: null })).toBe(true);
    expect(matchesWhere({ foo: undefined }, "foo = :bar", { bar: undefined })).toBe(true);
  });

  it("should handle multiple spaces and tabs", () => {
    const row = { foo: "bar" };
    expect(matchesWhere(row, "foo\t=\t'bar'", {})).toBe(true);
    expect(matchesWhere(row, "foo    =    'bar'", {})).toBe(true);
  });

  it("should distinguish boolean string vs boolean literal", () => {
    const row = { flag: true };
    expect(matchesWhere(row, "flag = 'true'", {})).toBe(false);
    expect(matchesWhere(row, "flag = true", {})).toBe(true);
    expect(matchesWhere({ flag: "true" }, "flag = 'true'", {})).toBe(true);
    expect(matchesWhere({ flag: "true" }, "flag = true", {})).toBe(false);
  });
});
