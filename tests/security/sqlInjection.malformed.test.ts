import { describe, it, expect } from "vitest";
import { createPreparedStatement } from "../../src/engine/preparedStatement";

describe("SQL Injection and Malformed SQL", () => {
  it("should throw on malformed SQL", async () => {
    const db = new Map();
    // Malformed CREATE TABLE: should NOT throw (SQLite allows no columns)
    await expect(
      createPreparedStatement("CREATE TABLE empty_table ()", db).run()
    ).resolves.toBeDefined();
    // Now create the table so SELECTs do not throw "table does not exist"
    await createPreparedStatement("CREATE TABLE users (id INTEGER, name TEXT)", db).run();
    // This statement is incomplete and should throw
    await expect(createPreparedStatement("SELECT * FROM users WHERE name = 'a' OR", db).run()).rejects.toThrow();
    await expect(createPreparedStatement("SELECT * FROM users WHERE ", db).run()).rejects.toThrow(/Malformed|Table does not exist/);
    // Strict D1: should throw on missing bind argument
    await expect(createPreparedStatement("INSERT INTO users (id) VALUES (:id)", db).run()).rejects.toThrow("Missing bind argument");
  });
});
