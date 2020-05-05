let games = require('../data/games')
Object.keys(games).forEach((year) => {
  games[year] = games[year].map((o) => {
    let split = o.date.split('-')
    let month = Number(split[0])
    o.date = `${month - 1}-${split[1]}`
    return o
  })
})
console.log(JSON.stringify(games, null, 2))
