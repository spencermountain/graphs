const somehow = require('somehow')
const spacetime = require('spacetime')
const population = require('../data/world-population')

const drawIt = function(start = 'Jan 1 1600') {
  let w = somehow({
    height: 200,
    width: 800
  })
  let year = spacetime(start).year()
  console.log(year)
  let data = population.filter(a => a[0] > year)

  data = data.map(a => {
    a[0] = 'jan 1 ' + a[0]
    return a
  })
  console.log(data)

  w.area()
    .set(data)
    .color('yellow')
  w.x.fit(start, Date.now())
  w.xAxis.ticks(10)
  w.y.fit()
  document.querySelector('#world').innerHTML = w.build()
}
module.exports = drawIt
