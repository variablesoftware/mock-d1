import { describe, it, expect } from "vitest";
import { handleCreateTable } from "../../src/engine/statementHandlers/handleCreateTable";

describe("handleCreateTable", () => {
  it("should create a table in the db map", () => {
    const db = new Map();
    handleCreateTable("CREATE TABLE foo (id INTEGER, name TEXT)", db);
    expect(db.has("foo")).toBe(true);
    expect(db.get("foo")?.rows[0]).toEqual({ id: undefined, name: undefined });
  });

  it("should throw if table already exists", () => {
    const db = new Map();
    handleCreateTable("CREATE TABLE foo (id INTEGER)", db);
    expect(() => handleCreateTable("CREATE TABLE foo (id INTEGER)", db)).toThrow();
  });

  it("should throw on malformed CREATE TABLE statement", () => {
    const db = new Map();
    expect(() => handleCreateTable("CREATE TABLE foo ()", db)).toThrow();
    expect(() => handleCreateTable("CREATE TABLE", db)).toThrow();
  });
});
