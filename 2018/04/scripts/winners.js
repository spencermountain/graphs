let data = require('../data/nhl-years')

data = data.sort((a, b) => a.year < b.year ? -1 : 1)
let toronto = data.filter((d) => /toronto/i.test(d.winner))
let montreal = data.filter((d) => /montr/i.test(d.winner))

toronto = toronto.map((d) => Number(d.year))
montreal = montreal.map((d) => Number(d.year))

let results = {
  toronto: toronto,
  montreal: montreal
}
console.log(JSON.stringify(results, null, 2))
