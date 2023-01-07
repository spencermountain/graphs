import { watch } from 'chokidar'
import buildOne from './build.js'
import server from './server.js'
import path from 'path'
const post = process.argv[2] || ''


import { fileURLToPath } from 'url'
const dir = path.dirname(fileURLToPath(import.meta.url))
let abs = path.join(dir, '../')
if (post) {
  abs = path.join(abs, `${post}`)
}
server(abs)

const doit = function () {
  buildOne(abs).then(() => {
    console.log('done')
  })
}

const watcher = watch(`${abs}/**/*.svelte`, {
  ignored: [/node_modules/, /(^|[\/\\])\../],
  persistent: true,
})
  .on('ready', () => {
    doit()
    watcher.on('add', () => {
      doit()
    })
    watcher.on('addDir', () => {
      doit()
    })
  })
  .on('change', () => {
    doit()
  })
  .on('unlink', () => {
    doit()
  })
  .on('unlinkDir', () => {
    doit()
  })
