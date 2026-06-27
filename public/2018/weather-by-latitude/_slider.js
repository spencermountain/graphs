let labels = require('./data/labels')
let latitudes = require('./data/by-latitude')
const drawCity = require('./_drawCity')
const sliderEl = document.querySelector('#slider')

const findClosest = function(num) {
  num = parseInt(num, 10)
  for (let i = 0; i < 50; i += 1) {
    let str = String(num + i)
    if (latitudes.hasOwnProperty(str)) {
      console.log(str)
      return latitudes[str]
    }
    str = String(num - i)
    if (latitudes.hasOwnProperty(str)) {
      console.log(str)
      return latitudes[str]
    }
  }
  console.log('missing latitude: ' + num)
  return null
}
// console.log(findClosest(89))


const makeSlider = function(w) {
  let slider = w.slider({
    max: 55,
    min: -55,
    value: 37,
    id: 'lat'
  })
  slider.title('Latitude:')
  labels = labels.map((a) => {
    let str = a[1] + '°  ' + a[0]
    return [str, a[1]]
  })
  slider.labels(labels)
  slider.callback = function(e) {
    this.world.state[this.id] = e.target.value
    let city = findClosest(e.target.value)
    drawCity(this.world, city)
    this.world.redraw()
  }
  sliderEl.innerHTML = slider.build()
}
module.exports = makeSlider
