const spacetime = require('spacetime')
const daylight = require('spacetime-daylight')
spacetime.extend(daylight)

const getSun = function () {
  let s = spacetime.today('Canada/Eastern')
  let hours = s.every('week', s.add(1, 'year'))
  hours.forEach((d) => {
    d = d.time('12:01pm')
    console.log(d.format('') + '   -   ' + d.sunPosition().altitude)
  })
}
module.exports = getSun

getSun()
