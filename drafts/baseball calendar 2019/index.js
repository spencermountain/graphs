// const sometime = require('sometime')
const sometime = require('/Users/spencer/mountain/sometime/src')
const schedules = require('./data/schedules')
const input = require('somehow-input')
const spacetime = require('spacetime')
const init = 'Toronto Blue Jays'
// console.log(sometime)
const home = 'blue'
const away = 'sky'

const drawTeam = function(team) {
  let cal = sometime.show('March 1 2019', 'Oct 1 2019')
  let schedule = schedules.find(o => o.team === team).games
  console.log(cal)
  schedule.forEach(game => {
    let date = game.date + ' 2019'
    let d = spacetime(date).minus(1, 'hour')
    let color = game.home ? home : away
    cal.color(d, date, color)
  })

  let today = spacetime.now()
  cal.color('Apr 5 2019', 'Apr 6 2019', 'red')
  let el = document.querySelector('#calendar')
  el.innerHTML = cal.build()
}

document.querySelector('#select').innerHTML = input
  .select({
    options: schedules.map(o => o.team),
    cb: val => {
      drawTeam(val)
    },
    value: init
  })
  .build()

drawTeam(init)
