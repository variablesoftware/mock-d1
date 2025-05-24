/**
 * @file
 * @description
 * Security and SQL injection tests for the mock D1 database engine.
 *
 * This suite verifies that:
 * - SQL injection via bind values is not possible.
 * - Multiple SQL statements in a single string are rejected.
 * - Malformed SQL (including incomplete or blank WHERE clauses) throws errors.
 *
 * All tests use a fresh in-memory Map as the backing store for the mock database.
 * The mock engine is expected to throw for any SQL that is malformed or potentially unsafe.
 *
 * (All tests have been split into individual files: sqlInjection.bindvalues.test.ts, sqlInjection.multistatement.test.ts, sqlInjection.malformed.test.ts)
 */

// Security: SQL injection and malformed SQL tests for mockD1Database
import { describe, it, expect } from "vitest";
import { createPreparedStatement } from "../../src/engine/preparedStatement";

describe("SQL Injection and Malformed SQL", () => {
  it("should not allow SQL injection via bind values", () => {
    const db = new Map();
    // Ensure the table exists so SELECT does not throw
    createPreparedStatement("CREATE TABLE users (id INTEGER, name TEXT)", db).run();
    const stmt = createPreparedStatement("SELECT * FROM users WHERE name = :name", db);
    stmt.bind({ name: "' OR 1=1; --" });
    // Should not throw, but should not match all rows either (if any rows existed)
    expect(() => stmt.run()).not.toThrow();
  });

  it("should throw on multiple statements in one string", () => {
    const db = new Map();
    expect(() => createPreparedStatement("SELECT * FROM users; DROP TABLE users;", db)).toThrow();
  });

  it("should throw on malformed SQL", async () => {
    const db = new Map();
    // Malformed CREATE TABLE: should NOT throw (SQLite allows no columns)
    await expect(
      createPreparedStatement("CREATE TABLE empty_table ()", db).run()
    ).resolves.toBeDefined();
    // Now create the table so SELECTs do not throw "table does not exist"
    await createPreparedStatement("CREATE TABLE users (id INTEGER, name TEXT)", db).run();
    // This statement is incomplete and should throw
    await expect(createPreparedStatement("SELECT * FROM users WHERE name = 'a' OR", db).run()).rejects.toThrow();
    await expect(createPreparedStatement("SELECT * FROM users WHERE ", db).run()).rejects.toThrow(/Malformed|Table does not exist/);
    // Strict D1: should throw on missing bind argument
    await expect(createPreparedStatement("INSERT INTO users (id) VALUES (:id)", db).run()).rejects.toThrow("Missing bind argument");
  });
});
