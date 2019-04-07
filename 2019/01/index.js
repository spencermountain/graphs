const somehow = require('somehow')
let inputs = require('somehow-input')
let divisions = require('./data/divisions')
const colors = require('./data/colors')
const byYear = {
  '2018-19': require('./data/year-2018'),
  '2017-18': require('./data/year-2017'),
  '2016-17': require('./data/year-2016'),
  '2015-16': require('./data/year-2015'),
  '2014-15': require('./data/year-2014')
  // '2013-14': require('./data/year-2013'),
  // '2012-13': require('./data/year-2012')
}

const doDivision = function(division, name, year, id) {
  let w = somehow({
    height: 200,
    width: 800
  })
  division.forEach(team => {
    let color = colors[team] || 'blue'
    let line = w
      .line()
      .width(2)
      .color(color)
    let games = (byYear[year][team] || {}).games || []
    games = games.filter(g => g[1] !== null)
    if (games.length > 0) {
      line.set(games)
      w.text(team)
        .font(10)
        .color(color)
        .set([games[games.length - 1]])
    }
  })
  year = year.replace(/-.*/, '')
  year = parseInt(year, 10)
  console.log(year)

  w.text(name + ':')
    .font(16)
    .color('olive')
    .set('-10%, 50%')
  w.line()
    .dotted(true)
    .color('lightgrey')
    .width(1)
    .set([['0px', 0], ['100%', 0]])

  w.y.fit(-20, 20)
  w.x.fit(`Oct 1 ${year}`, `April 20 ${year + 1}`)

  let el = document.querySelector(id)
  el.innerHTML = w.build()
}

const doYear = function(year) {
  doDivision(divisions['atlantic'], 'Atlantic', year, '#atlantic')
  doDivision(divisions['metro'], 'Metro', year, '#metro')
  doDivision(divisions['central'], 'Central', year, '#central')
  doDivision(divisions['pacific'], 'Pacific', year, '#pacific')
}
doYear('2018-19')

let yearSelect = inputs.select({
  options: ['2014-15', '2015-16', '2016-17', '2017-18', '2018-19'],
  value: '2018-19',
  label: 'year',
  cb: val => {
    console.log(val)
    doYear(val)
  }
})
document.querySelector('#year').innerHTML = yearSelect.build()
