const games = require('../data/games2.js')
const spacetime = require('spacetime')

let byYear = {}
Object.keys(games).forEach((k) => {
  let parse = k.match(/([0-9]{4})([0-9]{2})([0-9]{2})0/)
  let year = parseInt(parse[1], 10)
  let month = parseInt(parse[2], 10)
  let date = parseInt(parse[3], 10)
  byYear[year] = byYear[year] || []
  let s = spacetime({ year, month, date })
  byYear[year].push({
    date: s.format('{month-number}-{date}'),
    is_open: games[k],
  })
  // byYear[]
})
console.log(JSON.stringify(byYear, null, 2))
