import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.min.js', // output minified file by default
    format: 'esm',
    sourcemap: true,
    compact: true, // make output more compact
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
    terser(), // enable minification
  ],
  external: [], // add external dependencies here if needed
};