import { mockD1Database } from "../../src";
import { describe, expect, test } from "vitest";
import { D1_ERRORS } from "../../src/engine/errors";

describe("invalid testing - malformed SQL", () => {
  test("throws on malformed SQL", () => {
    const db = mockD1Database();
    expect(() => db.prepare("SELECT FROM")).toThrow(new RegExp(D1_ERRORS.MALFORMED_SELECT));
    expect(() => db.prepare("INSERT INTO")).toThrow(new RegExp(D1_ERRORS.MALFORMED_INSERT));
    expect(() => db.prepare("DELETE")).toThrow(new RegExp(D1_ERRORS.MALFORMED_DELETE));
  });
});
