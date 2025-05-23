import { mockD1Database } from "../../src";
import { describe, expect, test } from "vitest";

describe("edge/unit: error and malformed query handling", () => {
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

  test("should throw on CREATE TABLE with no columns", async () => {
    const db = mockD1Database();
    await expect(db.prepare("CREATE TABLE test_table ()").run()).rejects.toThrow("Syntax error: CREATE TABLE must define at least one column");
  });

  test("should throw on CREATE TABLE with empty column definition", async () => {
    const db = mockD1Database();
    await expect(db.prepare("CREATE TABLE test_table (id INT, )").run()).rejects.toThrow("Malformed CREATE TABLE statement: must define at least one column");
    await expect(db.prepare("CREATE TABLE test_table (, id INT)").run()).rejects.toThrow("Malformed CREATE TABLE statement: must define at least one column");
    await expect(db.prepare("CREATE TABLE test_table ( , )").run()).rejects.toThrow("Malformed CREATE TABLE statement: must define at least one column");
  });
});
