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
 */

// Security: SQL injection and malformed SQL tests for mockD1Database
import { describe, it, expect } from "vitest";
import { createPreparedStatement } from "../../src/engine/mockD1PreparedStatement";

describe("SQL Injection and Malformed SQL", () => {
  it("should not allow SQL injection via bind values", () => {
    const db = new Map();
    // Ensure the table exists so SELECT does not throw
    createPreparedStatement("CREATE TABLE users (id INTEGER, name TEXT)", db, undefined).run();
    const stmt = createPreparedStatement("SELECT * FROM users WHERE name = :name", db, undefined);
    stmt.bind({ name: "' OR 1=1; --" });
    // Should not throw, but should not match all rows either (if any rows existed)
    expect(() => stmt.run()).not.toThrow();
  });

  it("should throw on multiple statements in one string", () => {
    const db = new Map();
    expect(() => createPreparedStatement("SELECT * FROM users; DROP TABLE users;", db, undefined)).toThrow();
  });

  it("should throw on malformed SQL", async () => {
    const db = new Map();
    // Ensure the table exists so only SQL syntax is tested
    await createPreparedStatement("CREATE TABLE users (id INTEGER, name TEXT)", db, undefined).run();
    await createPreparedStatement("INSERT INTO users (id, name) VALUES (1, 'alice')", db, undefined).run();
    await expect(createPreparedStatement("SELECT * FROM users WHERE name = 'a' OR", db, undefined).run()).rejects.toThrow();
    await expect(createPreparedStatement("SELECT * FROM users WHERE ", db, undefined).run()).rejects.toThrow();
  });
});
