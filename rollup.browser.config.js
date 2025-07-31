import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.umd.js',
    format: 'umd',
    name: 'VitaeFlowSDK',
    sourcemap: true
  },
  plugins: [
    // Add Node.js polyfills for browser
    nodePolyfills(),
    
    // Replace Node.js globals and modules for browser compatibility
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production'),
      // Handle crypto require - use web crypto API
      "require('crypto')": 'globalThis.crypto || require("crypto-browserify")',
      // Replace Node.js modules that may leak from dependencies
      'require("url")': '{ fileURLToPath: (url) => url.replace("file://", ""), pathToFileURL: (path) => "file://" + path }',
      'require("path")': '{ join: (...args) => args.join("/"), dirname: (p) => p.split("/").slice(0, -1).join("/") }',
      'require("fs")': '{ existsSync: () => false, readFileSync: () => "{}" }',
    }),
    
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      exportConditions: ['browser', 'module', 'import', 'default']
    }),
    
    commonjs({
      ignoreDynamicRequires: true,
      transformMixedEsModules: true
    }),
    
    json(),
    
    typescript({
      tsconfig: 'tsconfig.browser.json',
      clean: true,
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    }),
    
    terser({
      compress: {
        drop_console: false,
        drop_debugger: true
      }
    })
  ],
  
  // Don't bundle these - they should be handled by the replace plugin or provided by environment
  external: [],
  
  // Handle warnings about Node.js built-ins
  onwarn(warning, warn) {
    // Skip warnings about Node.js built-ins being external
    if (warning.code === 'UNRESOLVED_IMPORT' && 
        ['crypto', 'fs', 'path', 'util'].includes(warning.source)) {
      return;
    }
    warn(warning);
  }
};