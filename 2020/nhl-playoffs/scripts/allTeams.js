const data = require('../data/playoffs.json')
let teams = {}
Object.keys(data).forEach((year) => {
  Object.keys(data[year]).forEach((team) => {
    teams[team] = true
  })
})
console.log(Object.keys(teams))
