import { mockD1Database } from "../../src";
import { describe, expect, test } from "vitest";
import { D1_ERRORS } from "../../src/engine/errors";

describe("invalid testing - malformed SQL", () => {
  test("throws on malformed SQL", () => {
    const db = mockD1Database();
    expect(() => db.prepare("SELECT FROM")).toThrow(new RegExp(D1_ERRORS.MALFORMED_SELECT));
    expect(() => db.prepare("INSERT INTO")).toThrow(new RegExp(D1_ERRORS.MALFORMED_INSERT));
    expect(() => db.prepare("DELETE")).toThrow(new RegExp(D1_ERRORS.MALFORMED_DELETE));
    expect(() => db.prepare("UPDATE foo SET")).toThrow(new RegExp(D1_ERRORS.MALFORMED_UPDATE));
    // For CREATE: expect UNSUPPORTED_SQL error
    expect(() => db.prepare("CREATE xkcd_" + Math.random().toString(36).slice(2)))
      .toThrow(new RegExp(D1_ERRORS.UNSUPPORTED_SQL));
    // DROP, TRUNCATE, ALTER are not recognized as valid top-level SQL and do not throw at prepare-time in this engine
  });
});
