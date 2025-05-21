// Stress tests for whereMatcher with large datasets and complex clauses
import { describe, it, expect } from "vitest";
import { matchesWhere } from "../../src/engine/whereMatcher";

describe("whereMatcher stress", () => {
  it("should handle large number of OR conditions", () => {
    const row = { a: 42 };
    const orClause = Array.from({ length: 1000 }, (_, i) => `a = ${i}`).join(" OR ");
    expect(matchesWhere(row, orClause, {})).toBe(true);
  });

  it("should handle deeply nested parentheses", () => {
    let clause = "a = 1";
    for (let i = 0; i < 20; i++) {
      clause = `(${clause})`;
    }
    const row = { a: 1 };
    expect(matchesWhere(row, clause, {})).toBe(true);
  });
});
