// const sometime = require('sometime')
const calendar = require('somehow-calendar')
const schedules = require('./data/schedules')
const input = require('somehow-input')
const init = 'Toronto Blue Jays'
// console.log(sometime)
const home = '#415abe'
const away = '#5969a6'

const options = {
  show_today: false
}

const drawTeam = function(team) {
  let cal = calendar.months('March 1 2019', 'Oct 2 2019', options)
  cal.width('2rem')
  cal.height('2rem')
  cal.radius('3px')
  let schedule = schedules.find(o => o.team === team).games
  schedule.forEach(game => {
    let date = game.date + ' 2019'
    let color = game.home ? home : away
    // cal.underline(date, color)
    cal.color(date, color)
  })

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
