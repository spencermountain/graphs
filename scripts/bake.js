const rollup = require('rollup')
const svelte = require('rollup-plugin-svelte')
const resolve = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')
const json = require('@rollup/plugin-json')

const path = require('path')
const post = process.argv[2] || ''

let abs = path.join(__dirname, '../')
if (post) {
  abs = path.join(abs, `${post}`)
}
console.log(abs)

abs = abs.replace(/\/$/, '')
rollup
  .rollup({
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
