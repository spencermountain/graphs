const sliderEl = document.querySelector('#slider')
const labels = [
  ['Calgary', 50],
  ['Toronto', 40],
  ['Philadelphia', 30],
  ['Havana', 20],
  ['Mexico City', 10],
  ['Medellín', 0],
  ['Lima', -10],
  ['São Paulo', -20],
  ['Buenos Aires', -30],
  ['Patagonia', -40],
  ['Falklands', -50]
]

const makeSlider = function(w) {
  // let slider = w.slider({
  //   max: 55,
  //   min: -55,
  //   value: 37,
  //   id: 'lat'
  // })
  // slider.title('Latitude:')
  // labels = labels.map(a => {
  //   let str = a[1] + '°  ' + a[0]
  //   return [str, a[1]]
  // })
  // slider.labels(labels)
  // slider.callback = function(e) {
  // this.world.state[this.id] = e.target.value
  // let city = findClosest(e.target.value)
  // drawCity(this.world, city)
  // this.world.redraw()
  // }
  // sliderEl.innerHTML = slider.build()
}
module.exports = makeSlider
