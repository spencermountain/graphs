const chokidar = require('chokidar')
const buildOne = require('./build')
const server = require('./server')
const path = require('path')
const post = process.argv[2] || ''

let abs = path.join(__dirname, '../')
if (post) {
  abs = path.join(abs, `${post}`)
}
server(abs)

const doit = function () {
  buildOne(abs).then(() => {
    console.log('done')
  })
}

const watcher = chokidar
  .watch(`${abs}/**/*.svelte`, {
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
