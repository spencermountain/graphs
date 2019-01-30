const somehow = require('somehow');
const arenas = require('./data/arenas');

let w = somehow({
  height: 300,
  width: 700,
// aspect: 'widescreen',
});

arenas.forEach((arena) => {
  let date = 'Oct 1 ' + arena.start
  w.bar().at(date, arena.size)
  w.text(arena.name).font(10).at(date, arena.size) //.rotate(90)
})
w.fit()

let el = document.querySelector('#capacity');
el.innerHTML = w.build()
