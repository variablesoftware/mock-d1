import { describe, expect, test, beforeEach } from "vitest";
import { mockD1Database } from "../../src";

describe("integration: DML operations", () => {
  let db: any;

  beforeEach(() => {
    db = mockD1Database();
    db.prepare("CREATE TABLE users (id INTEGER, name TEXT)").run();
  });

  test("DELETE FROM <table> deletes all rows", async () => {
    db.inject("users", [{ id: 1 }, { id: 2 }]);
    await db.prepare("DELETE FROM users").run();
    expect(db.dump().users.rows).toHaveLength(0);
  });

  test("UPDATE ... SET ... updates all rows", async () => {
    db.inject("users", [{ id: 1 }, { id: 2 }]);
    await db.prepare("UPDATE users SET name = :name").bind({ name: "bob" }).run();
    const dataRows = db.dump().users.rows.filter(r => r.id !== undefined);
    expect(dataRows.every((r: any) => r.name === "bob")).toBe(true);
  });
});
