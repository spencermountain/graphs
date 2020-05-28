const data = require('../data/cleanup.json')
console.log(data)
let byCol = []
let years = Object.keys(data)
years.forEach((year, i) => {
  let players = data[year]
  players = players.map((name, col) => {
    if (!name) {
      return name
    }
    // go forward
    let onTeam = 0
    year = Number(year)
    for (let y = year; y <= 2019; y += 1) {
      if (data[y][col] === name) {
        onTeam += 1
        data[y][col] = null
      } else {
        break
      }
    }
    name = { name: name, years: onTeam, start: year, col: col }
    byCol[col] = byCol[col] || []
    byCol[col].push(name)
    return name
  })
  data[year] = players
})

// console.log(JSON.stringify(data, null, 2))
console.log(JSON.stringify(byCol, null, 2))
