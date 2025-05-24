import { mockD1Database } from "../../src";
import { describe, expect, test } from "vitest";

const RUN_STRESS = process.env.D1_STRESS === "1";

(RUN_STRESS ? describe : describe.skip)("butter churn 🧈 (invalid stress testing) - malformed SQL", () => {
  test("throws on malformed SQL", () => {
    const db = mockD1Database();
    expect(() => db.prepare("SELECT FROM")).toThrow(/Malformed SELECT statement/);
    expect(() => db.prepare("INSERT INTO")).toThrow(/Malformed INSERT statement/);
    expect(() => db.prepare("DELETE")).toThrow(/Malformed DELETE statement/);
  });
});
