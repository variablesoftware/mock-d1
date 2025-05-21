// Extra edge-case and property-based tests for mockD1Database
import { describe, it, expect } from "vitest";
import { createPreparedStatement } from "../src/engine/mockD1PreparedStatement";

describe("mockD1Database extra edge cases", () => {
  it("should throw on SQL injection/malformed SQL", () => {
    const db = new Map();
    expect(() => createPreparedStatement("SELECT * FROM users; DROP TABLE users;", db, undefined)).toThrow();
    expect(() => createPreparedStatement("SELECT * FROM users WHERE name = 'a' OR 1=1", db, undefined)).not.toThrow();
  });

  it("should handle bind parameters with unusual types", async () => {
    const db = new Map();
    const stmt = createPreparedStatement("INSERT INTO users (id, data) VALUES (:id, :data)", db, undefined);
    stmt.bind({ id: 1, data: { foo: "bar" } });
    await expect(stmt.run()).resolves.toBeDefined();
  });

  it("should treat table/column names case-insensitively", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE Users (id INTEGER)", db, undefined).run();
    await createPreparedStatement("INSERT INTO users (id) VALUES (1)", db, undefined).run();
    const res = await createPreparedStatement("SELECT id FROM USERS", db, undefined).all();
    expect(res.results[0].id).toBe(1);
  });

  it("should throw on multiple statements in one string", () => {
    const db = new Map();
    expect(() => createPreparedStatement("SELECT * FROM users; SELECT * FROM users2;", db, undefined)).toThrow();
  });

  it("should allow table/column names that are SQL keywords", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE select (id INTEGER)", db, undefined).run();
    await createPreparedStatement("INSERT INTO select (id) VALUES (1)", db, undefined).run();
    const res = await createPreparedStatement("SELECT id FROM select", db, undefined).all();
    expect(res.results[0].id).toBe(1);
  });

  it("should throw on truncate/drop of nonexistent table", async () => {
    const db = new Map();
    await expect(createPreparedStatement("TRUNCATE TABLE nope", db, undefined).run()).rejects.toThrow();
    await expect(createPreparedStatement("DROP TABLE nope", db, undefined).run()).rejects.toThrow();
  });

  it("should throw on alter table add column with unsupported type", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE foo (id INTEGER)", db, undefined).run();
    await expect(createPreparedStatement("ALTER TABLE foo ADD COLUMN bar BOGUS", db, undefined).run()).rejects.toThrow();
  });

  it("should dump state after sequence of operations", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE foo (id INTEGER)", db, undefined).run();
    await createPreparedStatement("INSERT INTO foo (id) VALUES (42)", db, undefined).run();
    const stmt = createPreparedStatement("SELECT * FROM foo", db, undefined);
    const res = await stmt.all();
    expect(res.results[0].id).toBe(42);
  });

  it("should throw with correct error messages", () => {
    const db = new Map();
    expect(() => createPreparedStatement("DELETE", db, undefined)).toThrow(/Malformed DELETE/);
    expect(() => createPreparedStatement("INSERT INTO", db, undefined)).toThrow(/Malformed INSERT/);
  });
});
