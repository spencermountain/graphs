const somehow = require('somehow');
const colors = require('./data/colors');
let teams = require('./data/history');
const today = new Date().toISOString()

// teams = teams.sort((a, b) => a.start < b.start ? 1 : -1)
teams = teams.reverse()
let w = somehow({
  height: 900,
  width: 700,
});

teams.forEach((team, i) => {
  let end = team.end
  if (end) {
    end = 'April 1 ' + end
  } else {
    end = today
  }
  let start = 'Oct 1 ' + team.start
  let color = colors[team.team]
  w.line().width(12).color(color).set([
    [start, i],
    [end, i],
  ])
  let name = team.team
  // name += ' - ' + team.wins.length
  // if (team.wins.length > 0) {
  // }
  w.text(name).color(color).dx(5).font(12).at(end, i)
})

w.text('Teams:').at('0px', '105%')
w.fit()
w.x.fit('Jan 1 1942', today)
w.y.fit(-1)
// w.yAxis.remove()

let el = document.querySelector('#teams');
el.innerHTML = w.build()
