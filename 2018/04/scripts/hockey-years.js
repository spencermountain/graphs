const wtfNHL = require('wtf-nhl')
wtfNHL.history('Montreal Canadiens', 1964, 2018).catch(console.log).then((docs => {
  let years = []
  docs.map((obj) => {
    let season = obj.season
    let league = season.leaguerank || season.Leaguerank || season.LeagueRank || null
    let division = season.divisionrank || season.Divisionrank || season.DivisionRank || null
    years.push([obj.title.year, league, division])
  })
  years = years.sort((a, b) => a[0] < b[0] ? 1 : -1)
  years = years.map((a) => [a[0], a[2]])
  console.log(years)
}))
