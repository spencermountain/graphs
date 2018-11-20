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

sh.echo('./defaults/package.json').to(dir + '/package.json');
// sh.echo(JSON.stringify(pkg, null, 2)).to(dir + '/package.json');

setTimeout(() => {
  sh.exec(`rm -rf ${dir}`)
}, 7000)
