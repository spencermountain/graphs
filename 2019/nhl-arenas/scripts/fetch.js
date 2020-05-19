// const wtf = require('wtf_wikipedia')
const wtf = require('/Users/spencer/mountain/wtf_wikipedia/src')

wtf.fetch('List of National Hockey League arenas', (err, doc) => {
  let arenas = []
  let current = doc.tables(0).keyValue()
  current.forEach((o) => {
    let year = o['Season of first NHL game'].replace(/[\–-].*/, '')
    arenas.push({
      name: o.Arena,
      city: o.Location,
      team: o['Team(s)'],
      start: Number(year),
      end: new Date().getFullYear(),
      size: Number(o.Capacity.replace(/,/g, ''))
    })
  })
  let older = doc.section('Former arenas').tables()
  older.forEach((table) => {
    table.keyValue().forEach((o) => {
      if (o.Arena && o.Arena !== 'None') {
        let years = o['Years used'].split('–')
        arenas.push({
          name: o.Arena,
          city: o.Location,
          team: o['Team'],
          start: Number(years[0]),
          end: Number(years[1]),
          size: Number(o.Capacity.replace(/,/g, ''))
        })
      }
    })
  })
  arenas = arenas.sort((a, b) => a.start < b.start ? 1 : -1)
  console.log('module.exports=' + JSON.stringify(arenas, null, 2))
})
