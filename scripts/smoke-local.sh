#!/usr/bin/env bash
# scripts/smoke-local.sh - Automated local smoke test for @variablesoftware/mock-d1
# Usage: ./scripts/smoke-local.sh
set -xeuo pipefail

# Robust cleanup on exit or Ctrl+C
cleanup() {
  if [[ -n "${TMPDIR:-}" && -d "$TMPDIR" ]]; then
    rm -rf "$TMPDIR"
  fi
  cd "$OLDPWD"
}
trap cleanup EXIT INT TERM

PKG_NAME="@variablesoftware/mock-d1"
PKG_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$PKG_DIR"

# Build and pack the local package
yarn build
PKG_TGZ=$(npm pack --loglevel warn | tail -n1)

# Create temp dir and install the tarball
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
yarn init -y > /dev/null
# Use node_modules linker for compatibility
yarn config set nodeLinker node-modules

yarn add "$PKG_DIR/$PKG_TGZ"

# Diagnostics: list files in dist and show entry
ls -lR "node_modules/@variablesoftware/mock-d1/dist"
cat "node_modules/@variablesoftware/mock-d1/package.json"

# Get the installed package name from package.json
PKG_JSON="node_modules/@variablesoftware/mock-d1/package.json"
PKG_NAME=$(node -p "require('./$PKG_JSON').name")

# Create a minimal ESM test file using the dynamic package name
cat > test.mjs <<EOF
import { mockD1Database } from "$PKG_NAME";
const db = mockD1Database();
await db.prepare("CREATE TABLE users (id INTEGER, name TEXT)").run();
await db.prepare("INSERT INTO users (id, name) VALUES (:id, :name)").bind({ id: 1, name: 'alice' }).run();
const result = await db.prepare("SELECT * FROM users WHERE id = :id").bind({ id: 1 }).all();
if (!result.success || result.results.length !== 1 || result.results[0].name !== 'alice') {
  throw new Error("mock-d1 CREATE/INSERT/SELECT failed");
}
console.log("[I][test.mjs] mock-d1 smoke test ok");
EOF

# Run the test
node --version
node test.mjs

# Success message
echo '✅ Local smoke test succeeded'
