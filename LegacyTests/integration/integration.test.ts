import { mockD1Database } from "../../src/index";
import { randomSnake, randomData } from "../helpers";
import { describe, expect, test } from "vitest";
import { D1Row } from "../../src/types/MockD1Database";

// Integration: CRUD and query flows

describe("integration", () => {
  test("should return injected session data when stubbed after creation", async () => {
    const db = mockD1Database();
    db.inject("sessions", [{ sub: "user-abc" }]);
    const stmt = db.prepare("SELECT * FROM sessions");
    const result = await stmt.all();
    expect(result.results.length).toBe(1);
    expect((result.results[0] as D1Row).sub).toBe("user-abc");
  });

  test("should return first matching row using named bind args", async () => {
    const db = mockD1Database();
    db.inject("users", [
      { email: "a@example.com", status: "pending" },
      { email: "b@example.com", status: "active" },
    ]);
    const stmt = db.prepare("SELECT * FROM users WHERE status = :status").bind({ status: "active" });
    const result = await stmt.first();
    expect(result.results.length).toBe(1);
    expect((result.results[0] as D1Row).email).toBe("b@example.com");
  });

  test("should return results matching AND/OR logic", async () => {
    const db = mockD1Database();
    db.inject("users", [
      { email: "x@example.com", status: "active", role: "admin" },
      { email: "y@example.com", status: "disabled", role: "admin" },
      { email: "z@example.com", status: "active", role: "user" },
    ]);
    const stmt = db.prepare(
      "SELECT * FROM users WHERE role = :r OR status = :s AND role = :r2"
    ).bind({ r: "admin", s: "active", r2: "user" });
    const result = await stmt.all();
    expect(result.results.length).toBe(3);
  });

  test("should handle fallback case with no WHERE clause", async () => {
    const db = mockD1Database();
    db.inject("items", [{ id: 1 }, { id: 2 }]);
    const stmt = db.prepare("SELECT * FROM items");
    const result = await stmt.all();
    expect(result.results.length).toBe(2);
  });

  test("should error on missing bind argument", async () => {
    const db = mockD1Database();
    db.inject("users", []);
    const stmt = db.prepare("SELECT * FROM users WHERE role = :missing").bind({});
    await expect(stmt.all()).rejects.toThrow();
  });

  test("should support CREATE TABLE with random name", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    const sql = `CREATE TABLE IF NOT EXISTS ${table}`;
    const result = await db.prepare(sql).run();
    expect(result.success).toBe(true);
    expect(db.dump()).toHaveProperty(table);
  });

  test("should create unique random table and insert randomized data", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    const data = randomData(["id", "name"]);
    await db.prepare(`CREATE TABLE ${table} (id INTEGER, name TEXT)`).run();
    await expect(db.prepare(`INSERT INTO ${table} (id, name) VALUES (:id, :name)`).bind(data).run()).resolves.toBeDefined();
    await expect(db.prepare(`INSERT INTO ${table} (id, extra) VALUES (:id, :extra)`).bind({ id: 1, extra: 2 }).run()).rejects.toThrow("Attempted to insert with columns not present in schema");
  });

  test("should delete matching rows using AND/OR filters", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    await db.prepare(`CREATE TABLE ${table} (id INTEGER, name TEXT)`).run();
    db.inject(table, [{ id: 1, name: "a" }, { id: 2, name: "b" }, { id: 3, name: "c" }]);
    db.dump()[table].rows[0] = {};
    expect(() => db.inject(table, [{ id: 4, name: "d" }])).toThrow("Cannot inject: schema row is empty");
  });
});
