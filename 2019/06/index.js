const somehow = require('somehow')
const arenas = require('./data/arenas')
const colors = require('./data/colors')
require('./capacity')

let w = somehow({
  height: 900,
  width: 700
})

arenas.forEach((arena, i) => {
  let color = colors[arena.team] || 'blue'
  w.line()
    .set([['Oct 1 ' + arena.start, i], ['Oct 1 ' + arena.end, i]])
    .color(color)
    .title(arena.name + '\n' + arena.city)

  w.text(arena.name)
    .font(9)
    .color(color)
    .dx(4)
    .set([['Oct 1 ' + arena.end, i]])
})
w.fit()
w.yAxis.remove()

let el = document.querySelector('#history')
el.innerHTML = w.build()
