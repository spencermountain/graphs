const wtfNHL = require('wtf-nhl')
// wtfNHL.history('Montreal Canadiens', 1964, 2018).catch(console.log).then((docs => {
//   let years = []
//   docs.map((obj) => {
//     let season = obj.season
//     let league = season.leaguerank || season.Leaguerank || season.LeagueRank || null
//     let division = season.divisionrank || season.Divisionrank || season.DivisionRank || null
//     years.push([obj.title.year, league, division])
//   })
//   years = years.sort((a, b) => a[0] < b[0] ? 1 : -1)
//   years = years.map((a) => [a[0], a[2]])
//   console.log(years)
// }))
const wtf = require('wtf_wikipedia')

let years = []
for (let i = 1942; i < 2018; i += 1) {
  let nextYear = i - 1900
  if (nextYear > 100) {
    nextYear -= 100
  }
  nextYear += 1
  years.push(`${i}–${nextYear} NHL season`)
}
// console.log(years)

const parse = function(doc) {
  let info = doc.infoboxes('sports season')[0]
  if (!info) {
    console.log(doc.title())
    return {}
  }
  info = info.keyValue()
  return {
    year: doc.title().replace(/[\–-].*/, ''),
    dates: (info.duration || '').split(/[\–-]/).map(s => s.trim()),
    winner: info.finals_champ,
    second: info['finals_runner-up'],
    teams: Number(info.no_of_teams),
    games: Number(info.no_of_games),
    top_scorer: (info.top_scorer || '').replace(/\(.*?\)/, '').trim()
  }
}

// years = years.slice(4, 8)
wtf.fetch(years, (err, docs) => {
  let results = docs.map(parse)
  console.log('module.exports= ' + JSON.stringify(results, null, 2))
})
