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
sh.cat(__dirname + '/defaults/package.json').to(dir + '/package.json');

// index.html
sh.cat(__dirname + '/defaults/index.html').to(dir + '/index.html');

// index.js
sh.cat(__dirname + '/defaults/index.js').to(dir + '/index.js');

// spencer.min.css
sh.mkdir(dir + '/assets')
sh.cp('./node_modules/spencer-css/builds/spencer.min.css', dir + '/assets')


// setTimeout(() => {
//   sh.exec(`rm -rf ${dir}`)
// }, 7000)

// sh.cd(dir)
