
// const somehow = require('./assets/somehow');
const somehow = require('somehow');
// const somehow = require('/Users/spencer/mountain/somehow/src');
const makeSlider = require('./_slider')
// const drawCities = require('./_cities')
let stage = document.querySelector('#stage')
const value = 37
let latitudes = require('./data/by-latitude')
const drawCity = require('./_drawCity')

const year = new Date().getFullYear()
let today = new Date().toISOString()

let w = somehow({
  height: 250,
  aspect: 'widescreen',
  el: stage
});

//today line
w.line().color('lighter').width(1).set([
  [today, '20%'],
  [today, '80%'],
])
// 0 mid-line
w.line().at(null, 0).color('lightgrey').width(1).dotted(true)

//make initial line to share around
w.line({
  id: 'line'
}).color('blue')
w.text({
  text: '',
  id: 'label'
}).color('blue')

makeSlider(w)
drawCity(w, latitudes[value])

w.y.fit(-40, 40);
w.x.fit(`Jan 1 ${year}`, `Dec 31 ${year}`);

w.yAxis.ticks([{
  value: -30,
  label: '-30°'
}, {
  value: -15,
  label: '-15°'
}, {
  value: 0,
  label: '0 °'
}, {
  value: 15,
  label: '15°'
}, {
  value: 30,
  label: '30°'
}])
// logging
// let num = w.text(w.state.lat)
// num.at('50%', '50%')

stage.innerHTML = w.build()
