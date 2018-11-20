const sh = require('shelljs')
const year = new Date().getFullYear()

let current = sh.ls('-l', `./${year}`).length
let num = current + 1
if (num < 10) {
  num = '0' + num
}
num = String(num)
let dir = `./${year}/${num}`
console.log(`creating: ${dir}`)
sh.mkdir(dir)

// package.json
sh.echo('./defaults/package.json').to(dir + '/package.json');

// spencer.min.css
sh.cp('./node_modules/spencer-css/builds/spencer.min.css', dir)

setTimeout(() => {
  sh.exec(`rm -rf ${dir}`)
}, 7000)
