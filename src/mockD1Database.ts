/*
 * mockD1Database.ts v2 🧈 (updated for named bind support)
 *
 * A lightweight, test-optimized mock of Cloudflare's D1Database interface.
 * Designed for Workers unit testing without requiring a live D1 instance.
 *
 * ✅ Supported SQL commands (simplified parsing):
 *   - CREATE TABLE [IF NOT EXISTS]
 *   - DROP TABLE (stubbed via `delete db[table]` expected externally)
 *   - INSERT INTO ... VALUES (...)
 *   - SELECT * FROM ... WHERE ... (supports AND/OR + named binds)
 *   - DELETE FROM ... WHERE ... (with accurate changes count)
 *
 * 🧩 Internal mechanics:
 *   - Tables stored in `Map<string, { rows: D1Row[] }>`
 *   - Uses basic regex parsing — not SQL-standards compliant
 *   - No type coercion — binds and data are raw JS primitives
 *   - Validation of :bind args occurs during execution, not .bind()
 *   - Logs behavior when LOG includes "D1" at level 3 or above
 *
 * 🧪 Test-only helpers:
 *   - `inject(table, rows[])`: manually preload test data
 *   - `dump()`: returns full mock DB snapshot
 *   - `batch()`: stubbed to return empty D1Result[]
 *
 * 🧱 Design notes:
 *   - Safe for isolated tests (no persistence between runs)
 *   - Reflects Cloudflare D1 runtime quirks (bind usage, defer errors)
 *   - Implements prepare().bind().run()/all()/first()/raw() interface
 *
 * 🧠 Future support ideas:
 *   - UPDATE ... SET ... WHERE ...
 *   - LIKE, BETWEEN, NOT, nested conditions
 *   - JOIN or mock link handling
 *   - ORDER BY, LIMIT
 */

import { log } from "@variablesoftware/logface";

export function mockD1Database(): D1Database {
  const logger = log.withTag("mockD1");
  logger.info("mockD1Database instantiated");
  const db = new Map<string, { rows: D1Row[] }>();

  function prepare(sql: string): D1PreparedStatement {
    logger.debug(`[prepare] SQL: ${sql}`);
    let bindArgs: Record<string, unknown> = {};
    const normalized = sql.trim().toLowerCase();

    if (!/^(select|insert|delete|create|drop)\s/.test(normalized)) {
      throw new Error(
        `SQL syntax error: unsupported or malformed statement "${sql.slice(0, 30)}..."`,
      );
    }

    if (/^(select|delete)\s+from\s*$/i.test(normalized)) {
      throw new Error("SQL syntax error: missing table name in FROM clause");
    }
    if (
      /^(select|delete)\s+from\s*$/i.test(normalized) ||
      /^select\s+from\s+\w+/i.test(normalized)
    ) {
      throw new Error(
        "SQL syntax error: missing field list before FROM clause",
      );
    }

    if (/^insert\s+into\s+\w+\s*\(.*\)\s*values\s*\((.*)\)/i.test(normalized)) {
      const match = sql.match(/values\s*\((.*)\)/i);
      const count = match?.[1]?.split(",").length ?? 0;
      if (count < 1) {
        throw new Error(
          "SQL syntax error: VALUES clause must include at least one parameter",
        );
      }
    }

    const unsupported = [
      /\blike\b/i,
      /\bbetween\b/i,
      /\bjoin\b/i,
      /\bselect\s+.+\s+from.+\(.+\)/i,
    ];
    if (unsupported.some((regex) => regex.test(sql))) {
      logger.error(`Unsupported SQL construct in: ${sql}`);
      throw new Error(
        "SQL query uses unsupported syntax or features in this mock database.",
      );
    }

    const stmt: D1PreparedStatement = {
      bind(args: Record<string, unknown>) {
        bindArgs = args;
        return this;
      },

      async run(): Promise<D1Result> {
        if (/^create table/i.test(sql)) {
          const match =
            sql.match(/^create table if not exists (\w+)/i) ||
            sql.match(/^create table (\w+)/i);
          if (!match) throw new Error("Invalid CREATE TABLE statement.");
          const [, table] = match;
          if (!db.has(table)) {
            db.set(table, { rows: [] });
            logger.info(`Created table \"${table}\"`);
          }
          return { success: true, duration: 0 };
        }

        if (/^insert into/i.test(sql)) {
          const match = sql.match(
            /^insert into (\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i,
          );
          if (!match) throw new Error("Invalid INSERT INTO statement.");
          const [, table, columnsRaw] = match;
          const columns = columnsRaw.split(",").map((s) => s.trim());

          if (!db.has(table))
            throw new Error(`Table \"${table}\" does not exist.`);
          const rows = db.get(table)!.rows;

          const row: D1Row = {};
          for (const col of columns) {
            if (!(col in bindArgs))
              throw new Error(`Missing bind argument for :${col}`);
            row[col] = bindArgs[col];
          }

          rows.push(row);
          logger.info(`Inserted row into \"${table}\": ${JSON.stringify(row)}`);
          return { success: true, duration: 0 };
        }

        if (/^delete from/i.test(sql)) {
          const match = sql.match(/^delete from (\w+)/i);
          if (!match) throw new Error("Invalid DELETE FROM statement");
          const [, table] = match;
          const where = sql.match(/where (.+)/i)?.[1];
          const original = db.get(table)?.rows ?? [];

          const retained = where
            ? original.filter((row) => {
                return !where.split(/\s+or\s+/i).some((orGroup) => {
                  return orGroup.split(/\s+and\s+/i).every((cond) => {
                    const [key, , param] = cond.trim().split(/\s+/);
                    const argKey = param.replace(/^:/, "");
                    if (!(argKey in bindArgs))
                      throw new Error(`Missing bind for :${argKey}`);
                    return row[key] === bindArgs[argKey];
                  });
                });
              })
            : [];

          const removed = original.length - retained.length;
          db.set(table, { rows: retained });

          return { success: true, duration: 0, changes: removed };
        }

        logger.warn(`[run] Unsupported SQL: ${sql}`);
        return { success: true, duration: 0 };
      },

      async all(): Promise<D1Result> {
        const bindKeys = sql.match(/:[a-zA-Z_][a-zA-Z0-9_]*/g);
        if (bindKeys) {
          for (const key of bindKeys) {
            const clean = key.replace(/^:/, "");
            if (!(clean in bindArgs)) {
              throw new Error(`Missing bind for :${clean}`);
            }
          }
        }
        const match = sql.match(/from (\w+)/i);
        if (!match) throw new Error("Missing FROM clause");
        const [, table] = match;
        const whereClause = sql.match(/where (.+)/i)?.[1];

        const rows = db.get(table)?.rows ?? [];
        if (!whereClause) return { results: rows, success: true, duration: 0 };

        const filtered = rows.filter((row) => {
          return whereClause.split(/\s+or\s+/i).some((orGroup) => {
            return orGroup.split(/\s+and\s+/i).every((cond) => {
              const [key, , param] = cond.trim().split(/\s+/);
              const argKey = param.replace(/^:/, "");
              if (!(argKey in bindArgs))
                throw new Error(`Missing bind for :${argKey}`);
              return row[key] === bindArgs[argKey];
            });
          });
        });

        return { results: filtered, success: true, duration: 0 };
      },

      async first(): Promise<D1Result> {
        const all = await this.all();
        return {
          results: all.results?.length ? [all.results[0]] : [],
          success: all.success,
          duration: all.duration,
        };
      },

      async raw(): Promise<any[]> {
        const all = await this.all();
        return all.results ?? [];
      },
    };

    return stmt;
  }

  return {
    prepare,
    batch: async () => [],
    dump: () => Object.fromEntries(db),
    inject: (table: string, rows: D1Row[]) => {
      db.set(table, { rows });
    },
  } satisfies D1Database & {
    dump(): Record<string, unknown>;
    inject(table: string, rows: D1Row[]): void;
  };
}
