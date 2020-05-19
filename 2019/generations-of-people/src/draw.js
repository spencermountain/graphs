const lifespan = require('./_lifespan')
// const somehow = require('somehow')
const somehow = require('/Users/spencer/mountain/somehow/src')
const spacetime = require('spacetime')
const showEvents = require('./events')
// const drawWorld = require('./world')

let mGenLength = 25
let fGenLength = 20

const h = 15

const mNames = ['you', 'father', 'grandfather']
const fNames = ['you', 'mother', 'grandmother']

const toOrdinal = function(i) {
  var j = i % 10,
    k = i % 100
  if (j === 1 && k !== 11) {
    return i + 'st'
  }
  if (j === 2 && k !== 12) {
    return i + 'nd'
  }
  if (j === 3 && k !== 13) {
    return i + 'rd'
  }
  return i + 'th'
}

const drawIt = function(gens, age, gender) {
  let height = 200
  if (gens * h > height) {
    height = gens * h
  }
  let w = somehow({
    height: height,
    width: 800
  })

  let d = spacetime.now().minus(age, 'years')

  for (let i = 0; i < gens; i += 1) {
    let life = lifespan(d.year())
    let end = d.add(life, 'years')
    let color = 'blue'
    let genLength = mGenLength

    //do female version
    if (gender === 'maternal') {
      end = end.add(4, 'years')
      color = 'purple'
      genLength = fGenLength
    }
    if (end.isAfter(spacetime.now())) {
      end = spacetime.now()
    }
    //draw line
    w.line()
      .set([[d.iso(), i], [end.iso(), i]])
      .color(color)
    //draw text
    let name = gender === 'maternal' ? fNames[i] : mNames[i]
    if (!name) {
      name = toOrdinal(i) + ' gen'
      // name += gender === 'maternal' ? ' mother' : ' father'
    }
    w.text(name)
      .at(d.iso(), i)
      .font(9)
      .dy(2)
      .dx(5)

    d = d.minus(genLength, 'years')
  }
  w.fit()

  // console.time('ticks')
  // w.xAxis.ticks(10)
  // console.timeEnd('ticks')
  w.x.clip()

  showEvents(w)

  w.yAxis.remove()
  console.time('build')
  document.querySelector('#graph').innerHTML = w.build()
  console.timeEnd('build')

  //re-draw earth population graph too
  // console.time('earth')
  // drawWorld(d.iso())
  // console.timeEnd('earth')
}
module.exports = drawIt
