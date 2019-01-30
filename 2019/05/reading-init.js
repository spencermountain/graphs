const somehow = require('somehow');
const inputs = require('somehow-input')
const tick = require('./reading-tick')

let w = somehow({
  el: '#stage',
  height: 300,
  width: 700,
});

w.text('').size(28).at('20%', '80%').id('perDay')
w.text('pages per day').at('20%', '80%').dy(-10).dx(-20)
w.area().color('red').id('read-area')
w.annotation('').size(18).nudge(-160, 20).id('ending')
w.annotation('').size(14).nudge(40, 20).id('end-year')

w.y.fit(0, 100)
let endYear = new Date().getFullYear() + 101
w.x.fit('jan 1 2002', `jan 1 ${endYear}`)
window.someState.readGraph = w

//sliders
let id = 'wordsPerMinute'
let wordsPerMinute = inputs.slider({
  id: id,
  min: 120,
  value: window.someState.wordsPerMinute,
  max: 400,
  cb: (val) => {
    window.someState.wordsPerMinute = Number(val)
    tick()
  }
})
document.querySelector('#' + id).innerHTML = wordsPerMinute.build()

id = 'hoursPerDay'
let hoursPerDay = inputs.slider({
  id: id,
  min: 1,
  value: window.someState.hoursPerDay,
  step: 0.5,
  max: 24,
  cb: (val) => {
    window.someState.hoursPerDay = Number(val)
    tick()
  }
})
document.querySelector('#' + id).innerHTML = hoursPerDay.build()

id = 'daysPerYear'
let daysPerYear = inputs.slider({
  id: id,
  min: 1,
  value: window.someState.daysPerYear,
  max: 365,
  cb: (val) => {
    window.someState.daysPerYear = Number(val)
    tick()
  }
})
document.querySelector('#' + id).innerHTML = daysPerYear.build()

tick()
