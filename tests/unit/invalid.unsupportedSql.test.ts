import { mockD1Database } from "../../src";
import { describe, expect, test } from "vitest";
// DROP, TRUNCATE, ALTER are not recognized as valid top-level SQL and do not throw at prepare-time in this engine

describe("invalid testing - unsupported SQL", () => {
  test("does not throw on unsupported SQL (DROP, TRUNCATE, ALTER) at prepare-time", () => {
    const db = mockD1Database();
    expect(() => db.prepare("DROP qwerty_" + Math.random().toString(36).slice(2)))
      .not.toThrow();
    expect(() => db.prepare("TRUNCATE asdf_" + Math.random().toString(36).slice(2)))
      .not.toThrow();
    expect(() => db.prepare("ALTER zxcv_" + Math.random().toString(36).slice(2)))
      .not.toThrow();
  });
});
