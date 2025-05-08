// filepath: /Users/px/Private/Code/_Internet/com-variablesoftware/mock-kv/rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'esm', // or 'cjs' if you want CommonJS
    sourcemap: true,
  },
  plugins: [resolve(), commonjs(), typescript()],
  external: [], // add external dependencies here if needed
};