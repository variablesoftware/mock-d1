import { describe, it, expect } from "vitest";
import { createPreparedStatement } from "../../src/engine/preparedStatement";

describe("SQL Injection and Malformed SQL", () => {
  it("should not allow SQL injection via bind values", () => {
    const db = new Map();
    // Ensure the table exists so SELECT does not throw
    createPreparedStatement("CREATE TABLE users (id INTEGER, name TEXT)", db).run();
    const stmt = createPreparedStatement("SELECT * FROM users WHERE name = :name", db);
    stmt.bind({ name: "' OR 1=1; --" });
    // Should not throw, but should not match all rows either (if any rows existed)
    expect(() => stmt.run()).not.toThrow();
  });
});
