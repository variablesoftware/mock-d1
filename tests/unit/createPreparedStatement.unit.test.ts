import { describe, it, expect } from "vitest";
import { createPreparedStatement } from "../../src/engine/preparedStatement";

describe("createPreparedStatement", () => {
  it("should create a table and insert/select rows", async () => {
    const db = new Map();
    await createPreparedStatement("CREATE TABLE test (id INTEGER, name TEXT)", db).run();
    await createPreparedStatement("INSERT INTO test (id, name) VALUES (:id, :name)", db).bind({ id: 1, name: "foo" }).run();
    const res = await createPreparedStatement("SELECT id, name FROM test", db).all();
    expect(res.results).toEqual([{ id: 1, name: "foo" }]);
  });

  it("should throw on malformed SQL", () => {
    const db = new Map();
    expect(() => createPreparedStatement("INSERT INTO", db)).toThrow(/Malformed INSERT statement/);
    expect(() => createPreparedStatement("DELETE", db)).toThrow(/Unsupported SQL syntax/);
  });

  it("should throw on multiple statements in one string", () => {
    const db = new Map();
    expect(() => createPreparedStatement("SELECT * FROM test; SELECT * FROM test2;", db)).toThrow();
  });
});
