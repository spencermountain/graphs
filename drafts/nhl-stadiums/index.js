const somehow = require('somehow');
const arenas = require('./data/arenas');
require('./capacity')

let w = somehow({
  height: 300,
  width: 700,
// aspect: 'widescreen',
});

arenas.forEach((arena, i) => {
  w.line().set([
    ['Oct 1 ' + arena.start, i],
    ['Oct 1 ' + arena.end, i],
  ])
// w.text(arena.name).font(10).at(date, arena.size) //.rotate(90)
})
w.fit()

let el = document.querySelector('#history');
el.innerHTML = w.build()
