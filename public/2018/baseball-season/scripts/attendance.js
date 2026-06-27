const wtfMLB = require('wtf-mlb')
let teams = require('../data/teams')
// teams = teams.slice(0, 3)
const year = 2018
let results = {}

const doTeam = function(i, cb) {
  wtfMLB.fetch(teams[i], year).catch(console.log).then(data => {
    if (!data) {
      console.log(teams[i])
    } else {
      let games = data.games.filter((g) => g.home === true && g.attendance)
      games = games.map((o) => [o.date.replace(/\(.*?\)/, '') + ' ' + year, o.attendance])
      results[teams[i]] = {
        team: teams[i],
        year: year,
        games: games
      }
    }
    i += 1
    if (teams[i]) {
      return doTeam(i, cb)
    }
    return cb()
  })
}
doTeam(0, () => {
  console.log(JSON.stringify(results, null, 2))
})


// wtfMLB.history('St. Louis Cardinals', 1977, 2018).catch(console.log).then(data => {
//   data = data.map((obj) => {
//     if (!obj.games) {
//       console.log(obj.season)
//       return obj
//     }
//     // obj.games = obj.games.length
//     obj.games = obj.games.map((g) => {
//       let fifty = g.record.games / 2
//       let underOver = g.record.wins - fifty
//       return [g.date, g.attendance, underOver]
//     })
//     return obj
//   })
//   console.log(JSON.stringify(data, null, 2))
// })
