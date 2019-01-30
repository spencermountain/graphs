const somehow = require('/Users/spencer/mountain/somehow');
const compute = require('./compute')

let w = somehow({
  el: '#stage',
  height: 300,
  width: 700,
});

const drawGraph = function() {
  let data = compute(250, 8, 252, 200000)
  w.text((wo) => String(data.pagesPerDay)).size(28).at('20%', '80%')
  w.text('pages per day').at('20%', '80%').dy(-20).dx(-20)

  w.area().color('red').set(data.points)

  let last = data.points[data.points.length - 1]
  let text = [
    last[1] + '% complete',
  // 'after 100 years'
  ]
  w.annotation(text).size(18).at(last[0], last[1]).nudge(-180, 20)

  w.y.fit(0, 100)
  let endYear = new Date().getFullYear() + 101
  w.x.fit('jan 1 2002', `jan 1 ${endYear}`)

  document.querySelector('#stage').innerHTML = w.build()
}

drawGraph()

//sliders
let id = 'wordsPerMinute'
let wordsPerMinute = w.slider({
  id: id,
  min: 120,
  value: 250,
  max: 400
})
document.querySelector('#' + id).innerHTML = wordsPerMinute.build()

id = 'hoursPerDay'
let hoursPerDay = w.slider({
  id: id,
  min: 1,
  value: 8,
  max: 24
})
document.querySelector('#' + id).innerHTML = hoursPerDay.build()

id = 'dayPerYear'
let dayPerYear = w.slider({
  id: id,
  min: 1,
  value: 252,
  max: 360
})
document.querySelector('#' + id).innerHTML = dayPerYear.build()
