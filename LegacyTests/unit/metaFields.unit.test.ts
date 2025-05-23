import { mockD1Database } from "../../src/index";
import { randomSnake } from "../helpers";
import { describe, expect, test } from "vitest";

describe("unit: meta fields", () => {
  test("insert meta fields are correct", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    await db.prepare(`CREATE TABLE ${table} (id INTEGER, name TEXT)`).run();
    const data = { id: 1, name: "foo" };
    const result = await db.prepare(`INSERT INTO ${table} (id, name) VALUES (:id, :name)`).bind(data).run();
    expect(result.success).toBe(true);
    expect(result.meta.rows_written).toBe(1);
    expect(result.meta.changes).toBe(1);
    expect(result.meta.changed_db).toBe(true);
    expect(result.meta.rows_read).toBe(0);
    await expect(db.prepare(`INSERT INTO ${table} (id, extra) VALUES (:id, :extra)`).bind({ id: 1, extra: 2 }).run()).rejects.toThrow("Attempted to insert with columns not present in schema");
  });

  test("update meta fields are correct", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    await db.prepare(`CREATE TABLE ${table} (id INTEGER, name TEXT)`).run();
    db.inject(table, [{ id: 1, name: "foo" }]);
    const result = await db.prepare(`UPDATE ${table} SET name = :name WHERE id = :id`).bind({ id: 1, name: "bar" }).run();
    expect(result.success).toBe(true);
    expect(result.meta.rows_written).toBe(1);
    expect(result.meta.changes).toBe(1);
    expect(result.meta.changed_db).toBe(true);
    expect(result.meta.rows_read).toBe(1);
    await expect(db.prepare(`INSERT INTO ${table} (id, extra) VALUES (:id, :extra)`).bind({ id: 1, extra: 2 }).run()).rejects.toThrow("Attempted to insert with columns not present in schema");
  });

  test("delete meta fields are correct", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    await db.prepare(`CREATE TABLE ${table} (id INTEGER, name TEXT)`).run();
    db.inject(table, [{ id: 1, name: "foo" }]);
    const del = db.prepare(`DELETE FROM ${table} WHERE id = :id`).bind({ id: 1 });
    const result = await del.run();
    expect(result.success).toBe(true);
    expect(result.meta.changes).toBe(1);
    expect(result.meta.changed_db).toBe(true);
    expect(result.meta.rows_written).toBe(0);
    expect(result.meta.rows_read).toBe(0);
    db.dump()[table].rows[0] = {};
    expect(() => db.inject(table, [{ id: 2, name: "bar" }])).toThrow("Cannot inject: schema row is empty");
  });

  test("select meta fields are correct", async () => {
    const db = mockD1Database();
    const table = randomSnake();
    await db.prepare(`CREATE TABLE ${table} (id INTEGER, name TEXT)`).run();
    db.inject(table, [{ id: 1, name: "foo" }]);
    const select = db.prepare(`SELECT * FROM ${table} WHERE id = :id`).bind({ id: 1 });
    const result = await select.all();
    expect(result.success).toBe(true);
    expect(result.meta.rows_read).toBe(1);
    db.dump()[table].rows[0] = {};
    expect(() => db.inject(table, [{ id: 2, name: "bar" }])).toThrow("Cannot inject: schema row is empty");
  });
});
