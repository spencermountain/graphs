// const somehow = require('somehow');
const somehow = require('/Users/spencer/mountain/somehow/src');
let teams = require('./data/attendance')
let divisions = require('./data/divisions')

const colors = [
  'red',
  'green',
  'blue',
  'pink',
  'yellow',
  'olive',
  'brown',
  'purple',
]

const doDivision = function(key, id) {
  let w = somehow({
    height: 200,
    width: 1000
  });
  w.text(key + ':').font(16).color('olive').set('-10%, 50%')
  divisions[key].forEach((team, i) => {
    let line = w.line().width(2).color(colors[i] || 'blue')
    let games = teams[team].games
    if (games.length > 0) {
      line.set(games)
      w.text(team).font(10).color(colors[i]).set([games[games.length - 1]])
    }
  })

  w.y.fit(0, 60000);
  w.x.fit('Mar 20 2018', 'Oct 20 2018');

  let el = document.querySelector(id);
  el.innerHTML = w.build()
}

doDivision('alEast', '#alEast')
doDivision('alCentral', '#alCentral')
doDivision('alWest', '#alWest')
doDivision('nlEast', '#nlEast')
doDivision('nlCentral', '#nlCentral')
doDivision('nlWest', '#nlWest')
