const wtf = require('wtf_wikipedia')
let num = 1927
wtf.fetch('List_of_Stanley_Cup_champions').then((doc) => {
  let sec = doc.sections('NHL champions (since 1927)')
  let rows = sec.tables(0).json()
  rows = rows.map((row, i) => {
    let team = row['Winning team'].text || ''
    let found = null
    if (team.match(/vancouver/i)) {
      found = 'vancouver'
    }
    if (team.match(/calgary/i)) {
      found = 'calgary'
    }
    if (team.match(/edmonton/i)) {
      found = 'edmonton'
    }
    if (team.match(/winnipeg/i)) {
      found = 'winnipeg'
    }
    if (team.match(/toronto/i)) {
      found = 'toronto'
    }
    if (team.match(/ottawa/i)) {
      found = 'ottawa'
    }
    if (team.match(/montreal/i)) {
      found = 'montreal'
    }
    return {
      year: num + i,
      str: team,
      team: found,
    }
  })
  console.log(rows)
})
