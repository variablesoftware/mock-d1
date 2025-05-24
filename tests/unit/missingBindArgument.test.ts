import { mockD1Database } from "../../src";
import { describe, expect, test } from "vitest";

describe("butter churn 🧈 (invalid stress testing) - missing bind argument", () => {
  test("throws on missing bind argument", async () => {
    const db = mockD1Database();
    await db.prepare("CREATE TABLE IF NOT EXISTS foo (a INT, b INT)").run();
    const insert = db.prepare("INSERT INTO foo (a, b) VALUES (:a, :b)");
    await expect(insert.bind({ a: 1 }).run()).rejects.toThrow(/Missing bind argument/);
  });
});
