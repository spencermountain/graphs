const wtf = require('/Users/spencer/mountain/wtf_wikipedia/src/')
const plugin = require('/Users/spencer/mountain/wtf-nhl')
// const plugin = require('wtf-plugin-nhl')
wtf.extend(plugin)
let team = 'Toronto Maple Leafs'
let years = []
// for (let i = 1967; i <= 2019; i += 1) {
for (let i = 2009; i <= 2019; i += 1) {
  years.push(i)
}

let all = {}
// wtf.fetch(`Template:Toronto Maple Leafs roster`)
;(async () => {
  for (const year of years) {
    try {
      let data = await wtf.getSeason(team, year)
      console.log(year, data.roster.length)
      all[year] = data.roster.map((o) => [o.name, o.games])
    } catch (e) {
      console.log(year)
      console.log(e)
    }
  }
  console.log(JSON.stringify(all, null, 2))
})()
