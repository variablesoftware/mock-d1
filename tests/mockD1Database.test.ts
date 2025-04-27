/*
 * mockD1Database.test.ts 🧪
 *
 * Test suite for mockD1Database — a fully in-memory mock of the Cloudflare D1 interface.
 *
 * 🎯 Testing Philosophy:
 * - Focus on expressive, real-world SQL queries over trivial edge cases.
 * - Prefer randomized inputs and snake_case naming to mirror actual usage.
 * - Use `inject()` for direct data seeding and `dump()` to assert DB state.
 * - Aim to validate both positive behavior and expected failure modes.
 *
 * ✅ Coverage Areas:
 * - SELECT with WHERE, AND/OR, and named bind args
 * - INSERT and CREATE TABLE with dynamic column names
 * - DELETE with complex filter logic
 * - Unsupported SQL pattern rejection (LIKE, BETWEEN, JOIN, etc.)
 * - Missing bind param errors (runtime only)
 *
 * 🧰 Helpers:
 * - `randomAlpha()` – generates lowercase letters
 * - `randomSnake()` – composes snake_case identifiers
 * - `randomData(keys)` – creates randomized field values (string or number)
 */

import { mockD1Database } from "../src/mockD1Database";
import { describe, expect, test } from "vitest";

function randomAlpha(len = 6) {
  return Array.from({ length: len }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join("");
}

function randomSnake(len = 2) {
  return Array.from({ length: len }, () => randomAlpha(4)).join("_");
}

function randomData(keys: string[]) {
  const row: Record<string, string | number> = {};
  for (const key of keys) {
    row[key] =
      Math.random() < 0.5 ? randomAlpha(5) : Math.floor(Math.random() * 1000);
  }
  return row;
}

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

    const stmt = db
      .prepare("SELECT * FROM users WHERE status = :status")
      .bind({ status: "active" });
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

    const stmt = db
      .prepare(
        "SELECT * FROM users WHERE role = :r OR status = :s AND role = :r2",
      )
      .bind({ r: "admin", s: "active", r2: "user" });

    const result = await stmt.all();
    expect(result.results.length).toBe(3);
  });

  test("should throw on unsupported SQL syntax", () => {
    const db = mockD1Database();
    expect(() =>
      db.prepare('SELECT * FROM users WHERE status LIKE "%active%"'),
    ).toThrow();
    expect(() =>
      db.prepare("SELECT * FROM users WHERE score BETWEEN 1 AND 5"),
    ).toThrow();
    expect(() =>
      db.prepare("SELECT * FROM users JOIN roles ON users.role = roles.name"),
    ).toThrow();
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
    const stmt = db
      .prepare("SELECT * FROM users WHERE role = :missing")
      .bind({});
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
      `INSERT INTO ${table} (${colA}, ${colB}) VALUES (:${colA}, :${colB})`,
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

    const stmt = db
      .prepare(
        `DELETE FROM ${table} WHERE status = :s OR org = :o AND status = :s2`,
      )
      .bind({ s: "pending", o: "abc", s2: "active" });

    const result = await stmt.run();
    expect(result.success).toBe(true);
    expect(result.changes).toBe(3);

    const remaining = await db.prepare(`SELECT * FROM ${table}`).all();
    expect(remaining.results.length).toBe(0);
  });
});

describe("malformed queries", () => {
  test("should throw on invalid SQL syntax", () => {
    const db = mockD1Database();
    expect(() => db.prepare("SELECT FROM users")).toThrow();
    expect(() => db.prepare("DELETE FROM")).toThrow();
  });

  test("should throw on mismatched INSERT column/bind count", async () => {
    const db = mockD1Database();
    await db.prepare("CREATE TABLE test_table").run();
    const insert = db.prepare("INSERT INTO test_table (a, b) VALUES (:a)");
    await expect(insert.bind({ a: 1 }).run()).rejects.toThrow();
  });
});

describe("butter churn 🧈", () => {
  test("stress mockD1Database for a short duration", async () => {
    const db = mockD1Database();
    const end = Date.now() + 500;
    let count = 0;
    let inserts = 0;
    let selects = 0;
    let totalResults = 0;

    while (Date.now() < end) {
      const table = randomSnake();
      await db.prepare(`CREATE TABLE IF NOT EXISTS ${table}`).run();

      const colA = randomSnake(1);
      const colB = randomSnake(1);
      const data = randomData([colA, colB]);

      const insert = db.prepare(
        `INSERT INTO ${table} (${colA}, ${colB}) VALUES (:${colA}, :${colB})`,
      );
      await insert.bind(data).run();
      inserts++;

      const query = db.prepare(
        `SELECT * FROM ${table} WHERE ${colA} = :${colA} OR ${colB} = :${colB}`,
      );
      const result = await query.bind(data).all();
      selects++;
      totalResults += result.results.length;

      expect(result.results.length).toBeGreaterThanOrEqual(0);
      count++;
    }

    console.log(`[butter churn] completed ${count} cycles`);
    console.log(`[butter churn] inserts: ${inserts}, selects: ${selects}`);
    console.log(
      `[butter churn] total SELECT results returned: ${totalResults}`,
    );
    console.log(
      `[butter churn] avg results per SELECT: ${(totalResults / Math.max(1, selects)).toFixed(2)}`,
    );
  });
});
