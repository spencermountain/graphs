const rollup = require('rollup')
const svelte = require('rollup-plugin-svelte')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')
const json = require('@rollup/plugin-json')

const buildPost = function (abs) {
  abs = abs.replace(/\/$/, '')
  return rollup
    .rollup({
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

module.exports = buildPost
// buildPost('/Users/spencer/mountain/thensome/drafts/mayors-of-toronto')
