const rollup = require('rollup')
const svelte = require('rollup-plugin-svelte')
const resolve = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')

const buildPost = function (abs) {
  abs = abs.replace(/\/$/, '')
  console.log(abs)
  return (
    rollup
      .rollup({
        input: `${abs}/build/app.js`,
        plugins: [
          svelte({
            dev: true,
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
      // .then(() => {
      // fs.unlinkSync(`${abs}/_Post.html`)
      // })
      .catch((e) => {
        console.log(e)
      })
  )
}

module.exports = buildPost
// buildPost('/Users/spencer/mountain/thensome/drafts/mayors-of-toronto')
