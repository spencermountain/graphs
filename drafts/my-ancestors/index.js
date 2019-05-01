const somehow = require('somehow')
const tree = require('./data/tree.json')
const transform = require('./transform')
const render = require('./render')
const year = new Date().getFullYear()
//anyone still alive, set to max-year (now)
tree.parents[0].death = year
tree.parents[1].death = year
// console.log(tree)
const couples = transform.toCouples(tree)

let w = somehow({
  height: 700,
  width: 800
})

// render.drawTree(w,couples)
render.drawLifespan(w, couples)

w.yAxis.remove()

let el = document.querySelector('#stage')
el.innerHTML = w.build()
