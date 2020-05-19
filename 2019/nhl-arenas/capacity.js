const somehow = require('somehow')
const arenas = require('./data/arenas')
const colors = require('./data/colors')

let w = somehow({
  height: 300,
  width: 700
  // aspect: 'widescreen',
})

const dodge = {
  'Montreal Forum': -36,
  'Madison Square Garden': -16
}

arenas.forEach(arena => {
  let date = 'Oct 1 ' + arena.start
  let color = colors[arena.team] || 'blue'
  w.bar()
    .at(date, arena.size)
    .title(arena.name + '\n' + arena.city)
    .color(color)
  if (arena.show) {
    let label = [arena.name]
    if (arena.desc) {
      label.push(' (' + arena.desc + ')')
    }
    w.text(label)
      .font(10)
      .dx(dodge[arena.name] || -8)
      .dy(5)
      .color(color)
      .at(date, arena.size) //.rotate(90)
  }
})

w.line()
  .set([['sep 1 ' + 1939, '30%'], ['sep 1 ' + 1945, '30%']])
  .width(3)
  .color('rose')

w.text('(ww2)')
  .set([['sep 1 ' + 1939, '30%']])
  .dy(6)
  .font(12)
  .color('rose')

w.line()
  .set([['jan 1 ' + 1967, '10%'], ['jan 1 ' + 1967, '30%']])
  .width(2)
  .color('grey')
  .dotted(true)
w.text('NHL expansion:')
  .set([['jan 1 ' + 1952, '15%']])
  .dx(5)
  .dy(7)
  .font(12)
  .color('grey')

w.fit()

let el = document.querySelector('#capacity')
el.innerHTML = w.build()
