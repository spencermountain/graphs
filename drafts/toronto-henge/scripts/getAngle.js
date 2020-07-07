const spacetime = require('spacetime')
// const daylight = require('spacetime-daylight')
const daylight = require('/Users/spencer/mountain/spacetime-daylight/src')
spacetime.extend(daylight)

let weeks = spacetime('Jan 1 2020', 'Canada/Eastern').every(
  'week',
  spacetime('Dec 30 2020', 'Canada/Eastern')
)
weeks.forEach((d) => {
  console.log(d.format(), d.sunset().time())
})

// let d = spacetime('Nov 5th 3:30pm', 'Canada/Eastern')
// 6:43am
