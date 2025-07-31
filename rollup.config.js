import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.umd.js',
    format: 'umd',
    name: 'VitaeFlowSDK',
    sourcemap: true,
    globals: {
      'crypto': 'crypto'
    }
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: 'tsconfig.browser.json'
    }),
    terser()
  ],
  external: []
};