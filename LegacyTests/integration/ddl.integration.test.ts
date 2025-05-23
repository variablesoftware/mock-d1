import { describe, expect, test, beforeEach } from "vitest";
import { mockD1Database } from "../../src/index";

describe("integration: DDL operations", () => {
  let db: any;

  beforeEach(() => {
    db = mockD1Database();
  });

  test("DROP TABLE removes the table", async () => {
    db.inject("users", [{ id: 1 }]);
    await db.prepare("DROP TABLE users").run();
    expect(db.dump()).not.toHaveProperty("users");
  });

  test("TRUNCATE TABLE clears all rows", async () => {
    db.inject("users", [{ id: 1 }, { id: 2 }]);
    await db.prepare("TRUNCATE TABLE users").run();
    expect(db.dump().users.rows).toHaveLength(0);
  });

  test("ALTER TABLE ... ADD COLUMN adds column to all rows", async () => {
    db.inject("users", [{ id: 1 }, { id: 2 }]);
    await db.prepare("ALTER TABLE users ADD COLUMN age").run();
    expect(db.dump().users.rows[0]).toHaveProperty("age", undefined);
    expect(db.dump().users.rows[1]).toHaveProperty("age", undefined);
  });
});
