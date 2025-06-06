import { test } from 'vitest';

// Quick smoke test for npm package installability and importability from the npm registry
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

const shouldRunSmoke = process.env.D1_SMOKE_REGISTRY === '1';

test.skipIf(!shouldRunSmoke)('npm package can be installed and imported from registry (smoke test)', async () => {
  // Use a temp directory for the test
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-d1-smoke-registry-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    run('npm init -y');
    // Install the package from the registry (latest version)
    run('npm install @variablesoftware/mock-d1');
    // Read the installed package's package.json to find the entry point
    const pkgJson = require(path.join(tmpDir, 'node_modules', '@variablesoftware', 'mock-d1', 'package.json'));
    const entry = pkgJson.main || 'index.js';
    const entryPath = path.join(tmpDir, 'node_modules', '@variablesoftware', 'mock-d1', entry);
    // Debug: List files in the installed package directory
    const pkgDir = path.join(tmpDir, 'node_modules', '@variablesoftware', 'mock-d1');
    console.log('DEBUG: Contents of package dir:', fs.readdirSync(pkgDir));
    if (fs.existsSync(path.join(pkgDir, 'dist'))) {
      console.log('DEBUG: Contents of dist:', fs.readdirSync(path.join(pkgDir, 'dist')));
    } else {
      console.log('DEBUG: dist directory does not exist');
    }
    // Additional debug: List files in logface core dir
    const logfaceCoreDir = path.join(tmpDir, 'node_modules', '@variablesoftware', 'logface', 'dist', 'core');
    if (fs.existsSync(logfaceCoreDir)) {
      console.log('DEBUG: Contents of logface/dist/core:', fs.readdirSync(logfaceCoreDir));
    } else {
      console.log('DEBUG: logface/dist/core directory does not exist');
    }
    await import(entryPath);
    console.log('Smoke test passed: package can be installed and imported from registry.');
  } catch (e) {
    console.error('Smoke test from registry failed:', e);
    throw e;
  } finally {
    process.chdir(origCwd);
    // Clean up temp dir (optional, not deleting for debugging)
  }
}, 180000);
