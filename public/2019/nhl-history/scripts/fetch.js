const wtf = require('wtf_wikipedia')
let teams = require('../data/teams')
// teams = teams.slice(2, 4)

// no infobox: Atlanta Flames
// no infobox: Kansas City Scouts
// no infobox: Cleveland Barons
// no infobox: Minnesota North Stars

const parseTeam = function(doc) {
  let info = doc.infobox(0)
  if (!info) {
    console.log('no infobox: ' + doc.title())
    return {}
  }
  let obj = info.keyValue()

  let wins = obj.stanley_cups || ''
  wins = (wins.match(/\((.*?)\)/) || [])[1] || ''
  wins = wins.split(',').map(s => {
    s = s.replace(/[\-–].*/, '').trim()
    return parseInt(s, 10) || s
  })

  let history = obj.history || ''
  history = history.split(/\n/g)
  return {
    team: obj.team_name || doc.title(),
    start: parseInt(obj.founded, 10) || obj.founded,
    history: history,
    wins: wins
  }
}

wtf.fetch(teams, (err, docs) => {
  let result = docs.map(parseTeam)
  console.log('module.exports=' + JSON.stringify(result, null, 2))
})
