// Extra edge-case and property-based tests for mockD1Database
import { describe, it, expect } from "vitest";
import { createPreparedStatement } from "../../src/engine/preparedStatement";

describe("mockD1Database extra edge cases", () => {
  it("should throw on SQL injection/malformed SQL", () => {
    const db = new Map();
    expect(() => createPreparedStatement("SELECT * FROM users; DROP TABLE users;", db)).toThrow();
    expect(() => createPreparedStatement("SELECT * FROM users WHERE name = 'a' OR 1=1", db)).not.toThrow();
  });

  it("should handle bind parameters with unusual types", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE users (id INTEGER, data TEXT)", db).run();
    const stmt = createPreparedStatement("INSERT INTO users (id, data) VALUES (:id, :data)", db);
    stmt.bind({ id: 1, data: { foo: "bar" } });
    await expect(stmt.run()).resolves.toBeDefined();
  });

  it("should treat table/column names case-insensitively", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE Users (id INTEGER)", db).run();
    // Strict D1: must use .bind({ id: 1 })
    await createPreparedStatement("INSERT INTO users (id) VALUES (:id)", db).bind({ id: 1 }).run();
    const res = await createPreparedStatement("SELECT id FROM USERS", db).all();
    expect((res.results[0] as { id: number }).id).toBe(1);
  });

  it("should throw on multiple statements in one string", () => {
    const db = new Map();
    expect(() => createPreparedStatement("SELECT * FROM users; SELECT * FROM users2;", db)).toThrow();
  });

  it("should allow table/column names that are SQL keywords", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE select (id INTEGER)", db).run();
    await createPreparedStatement("INSERT INTO select (id) VALUES (:id)", db).bind({ id: 1 }).run();
    const res = await createPreparedStatement("SELECT id FROM select", db).all();
    expect((res.results[0] as { id: number }).id).toBe(1);
  });

  it("should throw on truncate/drop of nonexistent table", async () => {
    const db = new Map();
    // No table created here on purpose, as the test is for non-existent tables
    await expect(createPreparedStatement("TRUNCATE TABLE nope", db).run()).rejects.toThrow();
    await expect(createPreparedStatement("DROP TABLE nope", db).run()).rejects.toThrow();
  });

  it("should throw on alter table add column with unsupported type", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE foo (id INTEGER)", db).run();
    await expect(createPreparedStatement("ALTER TABLE foo ADD COLUMN bar BOGUS", db).run()).rejects.toThrow();
  });

  it("should dump state after sequence of operations", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE foo (id INTEGER)", db).run();
    await createPreparedStatement("INSERT INTO foo (id) VALUES (:id)", db).bind({ id: 42 }).run();
    const stmt = createPreparedStatement("SELECT * FROM foo", db);
    const res = await stmt.all();
    expect((res.results[0] as { id: number }).id).toBe(42);
  });

  it("should throw with correct error messages", () => {
    const db = new Map();
    expect(() => createPreparedStatement("DELETE", db)).toThrow(/Unsupported SQL syntax: This SQL command is not supported by D1/);
    expect(() => createPreparedStatement("INSERT INTO", db)).toThrow(/Malformed INSERT statement/);
  });
});
