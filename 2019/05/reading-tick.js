const compute = require('./reading-compute')
let el = document.querySelector('#stage')

const tick = function() {
  let w = window.someState.readGraph
  let state = window.someState
  let data = compute(state.wordsPerMinute, state.hoursPerDay, state.daysPerYear, state.growthRate)
  w.getShape('perDay').text(String(data.pagesPerDay))
  w.getShape('read-area').set(data.points)

  let last = data.points[data.points.length - 1]
  let text = [
    last[1] + '% complete'
  ]
  w.getShape('ending').text(text).at(last[0], last[1])

  let end = [`after`, `${data.points.length} years`]
  w.getShape('end-year').text(end).at(last[0], last[1])

  el.innerHTML = w.build()
}
module.exports = tick
