const somehow = require('somehow');
let teams = require('./data/attendance')

let w = somehow({
  height: 200,
  width: 1200
// aspect: 'widescreen',
});
const colors = [
  'red',
  'green',
  'blue',
  'pink',
  'yellow',
  'olive',
  'brown',
  'purple',

  'red',
  'green',
  'blue',
  'pink',
  'yellow',
  'olive',
  'brown',
  'purple',
]

teams.forEach((o, i) => {
  let line = w.line().width(2).color(colors[i] || 'blue')
  line.set(o.games)
})

w.line().color('lightgrey').width(1).dotted(true).set(`
0%, 53506
100%, 53506
`)

w.y.fit(0, 60000);
w.x.fit('Mar 1 2018', 'Oct 31 2018');
// w.x.fit();

let el = document.querySelector('#stage');
el.innerHTML = w.build()
