# @variablesoftware/mock-d1

[![Test Suite](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/variablesoftware/mock-d1/actions)

**Mock Cloudflare D1 Database for unit and integration testing**

`@variablesoftware/mock-d1` provides an in-memory simulation of Cloudflare's D1 SQLite-compatible database. It enables fast, isolated, and predictable testing of SQL-backed applications without relying on external services.

---

## 🔧 Installation

```bash
yarn add --dev @variablesoftware/mock-d1
```

> This package assumes a test environment with [Vitest](https://vitest.dev/) and support for ESM.

---

## 🚀 Usage

```ts
import { mockD1Database } from '@variablesoftware/mock-d1';

const db = mockD1Database({
  sessions: [
    { sub: 'user-123', jti: 'token-abc', created: Date.now() }
  ]
});

const stmt = db.prepare("SELECT * FROM sessions WHERE sub = ?");
stmt.bind('user-123');
const result = await stmt.all();

console.log(result.results); // [{ sub: 'user-123', ... }]
```

---

## 🎯 Goals

- ⚙ Match Cloudflare's behavior for testing real query flows
- 📐 Explicit mock factories preferred over static snapshots
- 📦 Eventually compatible with service bindings

## ✨ Features

- Fully in-memory, no persistent writes
- SQL-style `.prepare().bind().all()` and `.run()` flow
- Supports mock row injection
- Isolated per test run
- Compatible with Vitest and Hono-based Cloudflare Workers
- Logs via `@variablesoftware/logface`
- Supports simple `SELECT`, `INSERT`, `UPDATE`, and `DELETE` statements
- Optional `.dump()` method for snapshot inspection
- Returns results shaped like real Cloudflare `D1Result`
- **Does not coerce types or values** — faithfully returns your stored inputs
- Strives for parity with Cloudflare D1 behavior while keeping mocks debuggable

---

## 🧪 Test Coverage

Tested using `vitest run`, with coverage for:
- The "butter churn" suite stress-tests `mockD1Database()` with randomized insert/select/delete operations to simulate real query volume
- Basic SELECT queries
- Parameter binding
- Return shape matching Cloudflare's `D1Result`

Run tests:
```bash
yarn test
```

---

## 🚧 Status

**This package is under active development and not yet stable.**

Once stable, it will be published as:
```json
"@variablesoftware/mock-d1": "^0.1.0"
```

## 📄 License

MIT © Rob Friedman / Variable Software

---

## 🌐 Inclusive & Accessible Design

- Avoids assumptions about data type usage and intent
- Does not make coercive or opinionated transformations of stored values
- Designed for clarity, parity, and transparency with real D1 behavior
- Naming, error messages, and test data avoid cultural or ableist bias
- Useful in diverse developer environments with minimal surprise
