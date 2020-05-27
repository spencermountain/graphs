const data = require('../data/roster.json')

const sortYear = function (arr) {
  return arr.sort((a, b) => {
    if (a[1] > b[1]) {
      return -1
    } else if (a < b) {
      return 1
    }
    return 0
  })
}

let firstYear = data[2009]
firstYear = sortYear(firstYear)
firstYear = firstYear.slice(0, 20).map((o) => o[0])
let all = { 2009: firstYear }

let years = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019]
years.forEach((year) => {
  let players = data[year]
  players = sortYear(players)
  // stitch each year into the last
  let lastYear = all[year - 1]
  let newYear = [].concat(lastYear)
  newYear = newYear.map((name, i) => {
    let found = players.find((a) => a[0] === name)
    if (found) {
      return name
    }
    return null
  })
  all[year] = newYear
})
console.log(JSON.stringify(all, null, 2))
