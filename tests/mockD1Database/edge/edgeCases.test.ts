/**
 * @fileoverview
 * Edge case tests for mockD1Database.
 *
 * This suite tests the behavior of the mock database under various edge cases,
 * including malformed SQL statements, unsupported data types, and concurrency.
 */
import { mockD1Database } from "../../../src/mockD1Database";
import { describe, expect, test } from "vitest";

/**
 * Tests for malformed SQL statements.
 */
describe("mockD1Database edge cases", () => {
  test("should throw on malformed SQL statements", () => {
    const db = mockD1Database();
    expect(() => db.prepare("INSERT INTO test_table")).toThrow("Malformed INSERT statement");
    expect(() => db.prepare("SELECT FROM")).toThrow("Malformed SELECT statement");
    expect(() => db.prepare("DELETE")).toThrow("Malformed DELETE statement");
  });

  /**
   * Tests for unsupported data types.
   */
  test("should throw on unsupported data types in bindArgs", async () => {
    const db = mockD1Database();
    await db.prepare("CREATE TABLE test (colA TEXT)").run();

    const unsupportedData = { colA: () => {} }; // Function as a value
    await expect(db.prepare("INSERT INTO test (colA) VALUES (:colA)").bind(unsupportedData).run()).rejects.toThrow("Unsupported data type");
  });

  /**
   * Tests for concurrency handling.
   */
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
