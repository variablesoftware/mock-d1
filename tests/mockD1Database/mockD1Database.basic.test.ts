/**
 * @fileoverview
 * Basic CRUD and query tests for mockD1Database.
 * Covers positive-path usage, named binds, AND/OR logic, table creation, and deletion.
 *
 * @see mockD1Database.errors.test.ts for error/malformed query tests.
 * @see mockD1Database.stress.test.ts and mockD1Database.randomized.test.ts for stress and randomized tests.
 */
import { mockD1Database } from "../../src/mockD1Database";
import { randomSnake, randomData } from "../helpers";
import { describe, expect, test } from "vitest";

// process.env.LOG = 'none' || process.env.LOG;

describe("mockD1Database", () => {
  test("should return injected session data when stubbed after creation", async () => {
    const db = mockD1Database();
    db.inject("sessions", [{ sub: "user-abc" }]);
    const stmt = db.prepare("SELECT * FROM sessions");
    const result = await stmt.all();
    expect(result.results.length).toBe(1);
    expect(result.results[0].sub).toBe("user-abc");
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
    expect(result.results[0].email).toBe("b@example.com");
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
    const colA = randomSnake(1);
    const colB = randomSnake(1);
    await db.prepare(`CREATE TABLE ${table}`).run();
    const insert = db.prepare(
      `INSERT INTO ${table} (${colA}, ${colB}) VALUES (:${colA}, :${colB})`
    );
    const data = randomData([colA, colB]);
    const result = await insert.bind(data).run();
    expect(result.success).toBe(true);
    const rows = await db.prepare(`SELECT * FROM ${table}`).all();
    expect(rows.results.length).toBe(1);
    expect(rows.results[0][colA]).toBe(data[colA]);
    expect(rows.results[0][colB]).toBe(data[colB]);
  });

  test("should delete matching rows using AND/OR filters", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    await db.prepare(`CREATE TABLE ${table}`).run();
    const rows = [
      { id: 1, status: "pending", org: "abc" },
      { id: 2, status: "active", org: "abc" },
      { id: 3, status: "pending", org: "xyz" },
    ];
    db.inject(table, rows);
    const stmt = db.prepare(
      `DELETE FROM ${table} WHERE status = :s OR org = :o AND status = :s2`
    ).bind({ s: "pending", o: "abc", s2: "active" });
    const result = await stmt.run();
    expect(result.success).toBe(true);
    expect(result.changes).toBe(3);
    const remaining = await db.prepare(`SELECT * FROM ${table}`).all();
    expect(remaining.results.length).toBe(0);
  });
});

describe("mockD1Database meta fields", () => {
  test("insert meta fields are correct", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    const colA = randomSnake(1);
    const colB = randomSnake(1);
    await db.prepare(`CREATE TABLE ${table}`).run();
    const insert = db.prepare(
      `INSERT INTO ${table} (${colA}, ${colB}) VALUES (:${colA}, :${colB})`
    );
    const data = randomData([colA, colB]);
    const result = await insert.bind(data).run();
    expect(result.success).toBe(true);
    expect(result.meta.rows_written).toBe(1);
    expect(result.meta.changes).toBe(1);
    expect(result.meta.changed_db).toBe(true);
    expect(result.meta.rows_read).toBe(0);
  });

  test("update meta fields are correct", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    const colA = randomSnake(1);
    const colB = randomSnake(1);
    await db.prepare(`CREATE TABLE ${table}`).run();
    const data = randomData([colA, colB]);
    await db.prepare(
      `INSERT INTO ${table} (${colA}, ${colB}) VALUES (:${colA}, :${colB})`
    ).bind(data).run();
    const update = db.prepare(
      `UPDATE ${table} SET ${colB} = :newVal WHERE ${colA} = :matchVal`
    );
    const result = await update.bind({ newVal: "updated", matchVal: data[colA] }).run();
    expect(result.success).toBe(true);
    expect(result.meta.rows_written).toBe(1);
    expect(result.meta.changes).toBe(1);
    expect(result.meta.changed_db).toBe(true);
    expect(result.meta.rows_read).toBe(1);
  });

  test("delete meta fields are correct", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    await db.prepare(`CREATE TABLE ${table}`).run();
    db.inject(table, [{ id: 1 }, { id: 2 }]);
    const del = db.prepare(`DELETE FROM ${table} WHERE id = :id`).bind({ id: 1 });
    const result = await del.run();
    expect(result.success).toBe(true);
    expect(result.meta.changes).toBe(1);
    expect(result.meta.changed_db).toBe(true);
    // For delete, rows_written and rows_read are 0 in current mock, but changes is correct
    expect(result.meta.rows_written).toBe(0);
    expect(result.meta.rows_read).toBe(0);
  });

  test("select meta fields are correct", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    await db.prepare(`CREATE TABLE ${table}`).run();
    db.inject(table, [{ id: 1 }, { id: 2 }]);
    const select = db.prepare(`SELECT * FROM ${table} WHERE id = :id`).bind({ id: 1 });
    const result = await select.all();
    expect(result.success).toBe(true);
    expect(result.meta.rows_read).toBe(1);
    expect(result.meta.rows_written).toBe(0);
    expect(result.meta.changes).toBe(0);
    expect(result.meta.changed_db).toBe(false);
  });
});