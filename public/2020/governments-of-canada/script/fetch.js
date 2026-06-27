const wtf = require('wtf_wikipedia')
wtf.fetch('List of Canadian federal parliaments').then((doc) => {
  let rows = doc.tables(0).json()
  rows = rows.slice(2)
  rows = rows.map((row) => {
    let date = row.col3.text || ''
    date = date.split('&ndash;')
    let links = row.col4.links || []
    let seats = row.col5.text || ''
    let num = seats.match('^([0-9]+) of ([0-9]+)') || []
    seats = Number(num[1])
    let total = Number(num[2])

    let leader = links[1].text || links[1].page
    let party = links[0].page
    if (party.match(/(conservative|union)/i)) {
      party = 'Conservative'
    }
    return {
      start: date[0].trim().replace(/\./, ''),
      end: date[1].trim().replace(/\./, ''),
      party: party,
      majority: seats > total / 2,
      seats: seats,
      total: total,
      leader: leader,
    }
  })
  console.log(rows)
})
