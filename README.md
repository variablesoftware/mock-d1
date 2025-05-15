# @variablesoftware/mock-d1 🎛️🗂️🧠

[![Test Suite](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/variablesoftware/mock-d1/actions)
[![NPM version](https://img.shields.io/npm/v/@variablesoftware/mock-d1?style=flat-square)](https://www.npmjs.com/package/@variablesoftware/mock-d1)
[![License](https://img.shields.io/github/license/variablesoftware/mock-d1?style=flat-square)](https://github.com/variablesoftware/mock-d1/blob/main/LICENSE.txt)

**Mock Cloudflare D1 Database for unit and integration testing**

🎛️🗂️🧠 `@variablesoftware/mock-d1` provides an in-memory simulation of Cloudflare's D1 SQLite-compatible database. It enables fast, isolated, and predictable testing of SQL-backed applications without relying on external services.

---

## 🔧 Installation

```bash
yarn add --dev @variablesoftware/mock-d1
```

> This package assumes a test environment with [Vitest](https://vitest.dev/) and support for ESM.

---

## 🚀 Usage

```ts
import { mockD1Database } from "@variablesoftware/mock-d1";

const db = mockD1Database({
  sessions: [{ sub: "user-123", jti: "token-abc", created: Date.now() }],
});

const stmt = db.prepare("SELECT * FROM sessions WHERE sub = ?");
stmt.bind("user-123");
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
"@variablesoftware/mock-d1": "^0.5.0"
```

---

## 📄 License

MIT © Rob Friedman / Variable Software

---

> Built with ❤️ by [@variablesoftware](https://github.com/variablesoftware)  
> Thank you for downloading and using this project. Pull requests are warmly welcomed!

---

## 🌐 Inclusive & Accessible Design

- Naming, logging, error messages, and tests avoid cultural or ableist bias
- Avoids assumptions about input/output formats or encodings
- Faithfully reflects user data — no coercion or silent transformations
- Designed for clarity, predictability, and parity with underlying platforms (e.g., Cloudflare APIs)
- Works well in diverse, multilingual, and inclusive developer environments

---
