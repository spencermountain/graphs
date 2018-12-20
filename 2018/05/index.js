const somehow = require('somehow');
// const somehow = require('/Users/spencer/mountain/somehow/src');
let teams = require('./data/performance')
let divisions = require('./data/divisions')
console.log(somehow)
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

  // w.line().dotted(true).color('lightgrey').width(1).set([['Sept 30, 2018', 0], ['Sept 30, 2018', 30]])
  w.y.fit(-35, 35);
  w.x.fit('Mar 20 2018', 'Oct 20 2018');

  let el = document.querySelector(id);
  el.innerHTML = w.build()
}
console.time('draw')
doDivision('alEast', '#alEast')
doDivision('alCentral', '#alCentral')
doDivision('alWest', '#alWest')
doDivision('nlEast', '#nlEast')
doDivision('nlCentral', '#nlCentral')
doDivision('nlWest', '#nlWest')
console.timeEnd('draw') //usually 2.8 - 3.2 secs
