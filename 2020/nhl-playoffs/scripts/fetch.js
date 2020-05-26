// const wtf = require('wtf_wikipedia')
const wtf = require('/Users/spencer/mountain/wtf_wikipedia/src/')

let years = []
// for (let i = 1967; i <= 2019; i += 1) {
for (let i = 2013; i <= 2019; i += 1) {
  years.push(i)
}
years = ['1994', '1995']

const doit = async function (year) {
  console.log(year)
  // let doc = await wtf.fetch(year + ' Stanley Cup playoffs ')
  let doc = await wtf.fetch('Template:' + year + ' Stanley Cup playoffs')
  // let s = doc.sections('Playoff bracket')
  let s = doc
  let t = s.templates()[0]
  if (t.template === 'navbar') {
    t = s.templates()[1]
  }
  let teams = {}
  t.rounds.forEach((round, i) => {
    round.forEach((arr) => {
      arr.forEach((a) => {
        teams[a.team] = i + 1
      })
    })
  })
  let final = t.rounds[t.rounds.length - 1][0]
  let winner = final[1].team
  if (final[0].score > final[1].score) {
    winner = final[0].team
  }
  teams[winner] += 1
  return teams
}

let all = {}

;(async () => {
  for (let i = 0; i < years.length; i += 1) {
    let year = years[i]
    try {
      let res = await doit(year)
      all[year] = res
    } catch (e) {
      console.log(e)
    }
  }
  console.log(JSON.stringify(all, null, 2))
})()
