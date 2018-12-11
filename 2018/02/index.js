
const somehow = require('./assets/somehow');
// const somehow = require('/Users/spencer/mountain/somehow/src');
const makeSlider = require('./_slider')
// const drawCities = require('./_cities')
let stage = document.querySelector('#stage')
const value = 37
let latitudes = require('./data/by-latitude')
const drawCity = require('./_drawCity')

let w = somehow({
  height: 250,
  aspect: 'widescreen',
  el: stage
});

//make initial line to share around
w.line({
  id: 'line'
}).color('blue')
w.text({
  text: 'hi',
  id: 'label'
}).color('blue')

makeSlider(w)
drawCity(w, latitudes[value])

//today line
let day = w.line()
let d = new Date().getTime()
day.at(d, null)
day.color('lightgrey')
day.width(1)

// 0-line
let mid = w.line()
mid.at(null, 0)
mid.color('lightgrey')
mid.width(1)
mid.dotted(true)

w.y.fit(-40, 40);
w.x.fit('Jan 1 2018', 'Dec 31 2018');

// logging
let num = w.text(w.state.lat)
num.at('50%', '50%')

stage.innerHTML = w.build()
