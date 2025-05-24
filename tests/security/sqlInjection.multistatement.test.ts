import { describe, it, expect } from "vitest";
import { createPreparedStatement } from "../../src/engine/preparedStatement";

describe("SQL Injection and Malformed SQL", () => {
  it("should throw on multiple statements in one string", () => {
    const db = new Map();
    expect(() => createPreparedStatement("SELECT * FROM users; DROP TABLE users;", db)).toThrow();
  });
});
