// Unit tests for whereMatcher: unusual and edge-case types
import { describe, it, expect } from "vitest";
import { matchesWhere } from "../../src/engine/whereMatcher";

describe("whereMatcher unusual types", () => {
  it("should handle null and undefined", () => {
    const row = { foo: null, bar: undefined };
    expect(matchesWhere(row, "foo IS NULL", {})).toBe(true);
    expect(matchesWhere(row, "bar IS NULL", {})).toBe(true);
    expect(matchesWhere(row, "foo IS NOT NULL", {})).toBe(false);
  });

  it("should reject arrays and objects as bind values", () => {
    const row = { foo: 1 };
    expect(() => matchesWhere(row, "foo = :val", { val: [1, 2, 3] })).toThrow();
    expect(() => matchesWhere(row, "foo = :val", { val: { a: 1 } })).toThrow();
  });

  it("should handle booleans and numbers", () => {
    const row = { flag: true, num: 5 };
    expect(matchesWhere(row, "flag = true", {})).toBe(true);
    expect(matchesWhere(row, "num = 5", {})).toBe(true);
  });
});
