const somehow = require('somehow');
let teams = require('./data/performance')
let divisions = require('./data/divisions')

const colors = [
  'brown',
  'purple',
  'red',
  'pink',
  'olive',
  'yellow',
  'green',
  'blue',
]

const doDivision = function(key, id) {
  let w = somehow({
    height: 200,
    width: 800
  });
  divisions[key].forEach((team, i) => {
    let line = w.line().width(2).color(colors[i] || 'blue')
    let games = teams[team].games
    games = games.filter((g) => g[1] !== null)
    if (games.length > 0) {
      line.set(games)
      w.text(team).font(10).color(colors[i]).set([games[games.length - 1]])
    }
  })

  w.text(key + ':').font(16).color('olive').set('-10%, 50%')
  w.line().dotted(true).color('lightgrey').width(1).set([['0px', 0], ['100%', 0]])

  w.y.fit(-20, 20);
  w.x.fit('Oct 1 2018', 'March 20 2019');

  let el = document.querySelector(id);
  el.innerHTML = w.build()
}
console.time('draw')
doDivision('atlantic', '#atlantic')
doDivision('metro', '#metro')
doDivision('central', '#central')
doDivision('pacific', '#pacific')
console.timeEnd('draw') //usually 2.8 - 3.2 secs
