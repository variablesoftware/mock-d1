import { describe, expect, test, beforeEach } from "vitest";
// import { log } from "@variablesoftware/logface";
// process.env.LOG = 'none' || process.env.LOG;
import { mockD1Database } from "../../src/mockD1Database";

describe("DML operations", () => {
  let db: any;

  beforeEach(() => {
    db = mockD1Database();
  });

  test("DELETE FROM <table> deletes all rows", async () => {
    db.inject("users", [{ id: 1 }, { id: 2 }]);
    await db.prepare("DELETE FROM users").run();
    expect(db.dump().users.rows).toHaveLength(0);
  });

  test("UPDATE ... SET ... updates all rows", async () => {
    db.inject("users", [{ id: 1 }, { id: 2 }]);
    await db.prepare("UPDATE users SET name = :name").bind({ name: "bob" }).run();
    // Only check data rows (skip schema row)
    const dataRows = db.dump().users.rows.filter(r => r.id !== undefined);
    expect(dataRows.every((r: any) => r.name === "bob")).toBe(true);
  });
});