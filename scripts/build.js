import { rollup as _rollup } from 'rollup'
import svelte from 'rollup-plugin-svelte'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'

const buildPost = function (abs) {
  abs = abs.replace(/\/$/, '')
  return _rollup({
    input: `${abs}/build/app.js`,
    plugins: [
      json(),
      svelte({
        dev: true,
        css: true,
      }),
      nodeResolve(),
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
}

export default buildPost
// buildPost('/Users/spencer/mountain/thensome/drafts/mayors-of-toronto')
