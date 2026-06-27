const games = require('../data/games')
let all = []

/** add spaces at the end */
const padEnd = function (str, width) {
  str = str.toString()
  while (str.length < width) {
    str += ' '
  }
  return str
}

console.log()

Object.keys(games).forEach((year) => {
  games[year].forEach((o) => {
    let date = o.date.split(/-/).map((str) => str.padStart(2, '0'))
    date = [year, date[0], date[1]].join('-')
    all.push({ date: date, status: o.is_open })
  })
})

console.log(JSON.stringify(all, null, 2))
