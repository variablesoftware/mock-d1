import { mockD1Database } from "../../src";
import { describe, expect, test } from "vitest";

describe("edge: edge case handling", () => {
  test("should throw on malformed SQL statements", () => {
    const db = mockD1Database();
    expect(() => db.prepare("INSERT INTO test_table")).toThrow("Malformed INSERT statement");
    expect(() => db.prepare("SELECT FROM")).toThrow("Malformed SELECT statement");
    expect(() => db.prepare("DELETE")).toThrow("Malformed DELETE statement");
  });

  test("should throw on unsupported data types in bindArgs", async () => {
    const db = mockD1Database();
    await db.prepare("CREATE TABLE test (colA TEXT)").run();
    const unsupportedData = { colA: () => {} };
    await expect(db.prepare("INSERT INTO test (colA) VALUES (:colA)").bind(unsupportedData).run()).rejects.toThrow("Unsupported data type");
  });

  test("should handle concurrent inserts", async () => {
    const db = mockD1Database();
    await db.prepare("CREATE TABLE test (colA TEXT)").run();
    const insertPromises = Array.from({ length: 10 }, (_, i) =>
      db.prepare("INSERT INTO test (colA) VALUES (:colA)").bind({ colA: `value${i}` }).run()
    );
    await Promise.all(insertPromises);
    const results = await db.prepare("SELECT * FROM test").all();
    expect(results.results.length).toBe(10);
  });
});
