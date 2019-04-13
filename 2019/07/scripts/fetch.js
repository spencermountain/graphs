const wtfMLB = require('wtf-mlb')
const slow = require('slow')
const fs = require('fs')
let teams = require('../data/teams')
teams = Object.keys(teams)
const year = 2019
// teams = teams.slice(0, 3)

let allTeams = []

// no game log section for: '2019 Atlanta Braves season'
// no game log section for: '2019 Cleveland Indians season'
// no game log section for: '2019 Oakland Athletics season'
// no game log section for: '2019 Pittsburgh Pirates season'
// no game log section for: '2019 St. Louis Cardinals season'

const doTeam = function(team, cb) {
  wtfMLB.fetch(team, year).then((res) => {
    allTeams.push({
      team: team,
      games: res.games.map((o) => {
        return {
          date: o.date,
          home: o.home
        }
      })
    })
    cb(res)
  })
}

slow.steady(teams, doTeam, () => {
  let str = JSON.stringify(allTeams, null, 2)
  fs.writeFileSync('./data/schedules.js', 'module.exports= ' + str)
  console.log('done')
})
