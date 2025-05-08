/**
 * @fileoverview
 * Error and malformed query tests for mockD1Database.
 * Ensures the mock correctly throws on invalid SQL, unsupported features, and bind mismatches.
 *
 * @see mockD1Database.basic.test.ts for basic CRUD tests.
 */
import { mockD1Database } from "../src/mockD1Database";
import { describe, expect, test } from "vitest";

// process.env.LOG = 'none' || process.env.LOG;

describe("malformed queries", () => {
  test("should throw on invalid SQL syntax", () => {
    const db = mockD1Database();
    expect(() => db.prepare("SELECT FROM users")).toThrow();
    expect(() => db.prepare("DELETE FROM")).toThrow();
  });

  test("should throw on unsupported SQL syntax", () => {
    const db = mockD1Database();
    expect(() =>
      db.prepare('SELECT * FROM users WHERE status LIKE "%active%"')
    ).toThrow();
    expect(() =>
      db.prepare("SELECT * FROM users WHERE score BETWEEN 1 AND 5")
    ).toThrow();
    expect(() =>
      db.prepare("SELECT * FROM users JOIN roles ON users.role = roles.name")
    ).toThrow();
  });

  test("should throw on mismatched INSERT column/bind count", async () => {
    const db = mockD1Database();
    await db.prepare("CREATE TABLE test_table").run();
    const insert = db.prepare("INSERT INTO test_table (a, b) VALUES (:a)");
    await expect(insert.bind({ a: 1 }).run()).rejects.toThrow();
  });
});