const somehow = require('/Users/spencer/mountain/somehow');
const compute = require('./reading-compute')

let w = somehow({
  el: '#stage',
  height: 300,
  width: 700,
});

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

id = 'daysPerYear'
let daysPerYear = w.slider({
  id: id,
  min: 1,
  value: 252,
  max: 360
})
document.querySelector('#' + id).innerHTML = daysPerYear.build()


const drawGraph = function() {
  let data = compute(250, 8, 252)
  w.text((wo) => {
    data = compute(wo.state.wordsPerMinute, wo.state.hoursPerDay, wo.state.daysPerYear)
    return String(data.pagesPerDay)
  }).size(28).at('20%', '80%')
  w.text('pages per day').at('20%', '80%').dy(-20).dx(-20)

  w.area().color('red').set(data.points)

  let last = data.points[data.points.length - 1]
  let text = [
    last[1] + '% complete'
  ]
  w.annotation(text).size(18).at(last[0], last[1]).nudge(-160, 20)

  w.y.fit(0, 100)
  let endYear = new Date().getFullYear() + 101
  w.x.fit('jan 1 2002', `jan 1 ${endYear}`)

  document.querySelector('#stage').innerHTML = w.build()
}

drawGraph()
