const sh = require('shelljs')
let name = process.argv.slice(2).join(' ')
// const year = new Date().getFullYear()

let current = sh.ls('-l', `./drafts`).length
let num = current + 1
if (num < 10) {
  num = '0' + num
}
num = String(num)
let dir = `./drafts/${name || num}`
// console.log(`creating: ${dir}`)
// sh.mkdir(dir)

sh.cp('-R', './scripts/defaults/', dir)
