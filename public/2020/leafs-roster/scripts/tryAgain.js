const data = require('../data/cleanup.json')

// const colors = require('spencer-color')
// console.log(colors)
const colors = [
  '#cc7066',
  '#2D85A8',
  '#c67a53',
  '#8BA3A2',
  '#dfb59f',
  '#C4ABAB',
  '#6699cc',
  '#6accb2',
  '#e1e6b3',
  '#cc7066',
  '#F2C0BB',
  '#a3a5a5',
  '#C4ABAB',
  '#8C8C88',
  '#705E5C',
  '#2D85A8',
  '#e6d7b3',
  '#cc7066',
]

// make names only new players
let years = Object.keys(data)

for (let i = years.length - 1; i > 0; i -= 1) {
  let year = years[i]
  data[year] = data[year].map((player, col) => {
    if (years[i - 1] && data[years[i - 1]][col] === player) {
      return null
    }
    return player
  })
}
// give counts to each player

for (let i = 0; i < years.length; i += 1) {
  let year = years[i]
  data[year] = data[year].map((player, col) => {
    if (!player) {
      return null
    }
    let count = 1
    // go forward
    for (let o = i + 1; o < years.length; o += 1) {
      // console.log(data[years[o]][col])
      if (data[years[o]][col] === null) {
        count += 1
      } else {
        break
      }
    }
    return [player, count, colors[i]]
  })
}

let byCount = []
for (let i = 0; i < data[2019].length; i += 1) {
  byCount[i] = byCount[i] || []
  for (let col = 0; col < years.length; col += 1) {
    let year = years[col]
    if (data[year][i]) {
      let arr = data[year][i]
      byCount[i].push({
        name: arr[0],
        years: arr[1],
        color: arr[2],
        start: year,
        col: i,
      })
    }
  }
}

// console.dir(data)
// console.log(JSON.stringify(data, null, 1))
console.log(JSON.stringify(byCount, null, 1))
