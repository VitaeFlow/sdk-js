import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.umd.js',
    format: 'umd',
    name: 'VitaeFlow',
    sourcemap: true
  },
  plugins: [
    typescript({
      typescript: require('typescript'),
      tsconfig: 'tsconfig.browser.json'
    }),
    terser()
  ],
  external: []
};