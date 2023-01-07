import { rollup as _rollup } from 'rollup'
import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'

import { join } from 'path'
const post = process.argv[2] || ''

let abs = join(__dirname, '../')
if (post) {
  abs = join(abs, `${post}`)
}
console.log(abs)

abs = abs.replace(/\/$/, '')
_rollup({
  input: `${abs}/build/app.js`,
  plugins: [
    json(),
    svelte({
      dev: true,
      generate: 'ssr',
      css: (css) => {
        css.write(`${abs}/build/bundle.css`, false)
      },
    }),
    resolve({
      browser: true,
      dedupe: ['svelte'],
    }),
    commonjs(),
  ],
})
  .then((bundle) => {
    bundle.write({
      sourcemap: false,
      format: 'iife',
      name: 'app',
      file: `${abs}/build/bundle.js`,
    })
  })
  .catch((e) => {
    console.log(e)
  })
