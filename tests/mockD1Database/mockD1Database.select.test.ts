import { describe, expect, test, beforeEach } from "vitest";
// import { log } from "@variablesoftware/logface";
// process.env.LOG = 'none' || process.env.LOG;
import { mockD1Database } from "../../src/mockD1Database";

describe("SELECT query variants", () => {
  let db: any;

  beforeEach(() => {
    db = mockD1Database();
  });

  test("SELECT COUNT(*) FROM <table> returns correct count", async () => {
    db.inject("users", [{ id: 1 }, { id: 2 }]);
    const result = await db.prepare("SELECT COUNT(*) FROM users").all();
    expect(result.results[0]["COUNT(*)"]).toBe(2);
  });

  test("SELECT <columns> FROM <table> returns only specified columns", async () => {
    db.inject("users", [{ id: 1, name: "alice", age: 30 }]);
    const result = await db.prepare("SELECT id, name FROM users").all();
    expect(result.results[0]).toEqual({ id: 1, name: "alice" });
    expect(result.results[0]).not.toHaveProperty("age");
  });
});