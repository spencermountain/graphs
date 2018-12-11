
// const somehow = require('./assets/somehow');
// const somehow = require('somehow');
const somehow = require('/Users/spencer/mountain/somehow/src');
const latitudes = require('./data/by-latitude')
let stage = document.querySelector('#stage')

let w = somehow({
  height: 250,
  aspect: 'widescreen',
  el: stage
});

const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
]
const colors = [
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'olive',
  'pink',
  'beige',
]

Object.keys(latitudes).forEach((k, n) => {
  let city = latitudes[k]
  let arr = city.weather.split(',').map((temp, i) => {
    let date = months[i] + ' 1 2018'
    return [date, Number(temp)]
  })
  //add start to very end
  arr.push(['Dec 31 2018', arr[0][1]])
  let color = colors[n]
  let l = w.line()
  l.set(arr)
  l.color(color)
  let t = w.text(latitudes[k].city).font(8)
  t.dx(5).color(color)
  t.after('Dec 31 2018', arr[arr.length - 1][1])
})

//today line
let day = w.line()
let d = new Date().getTime()
day.at(d, null)
day.color('lightgrey')
day.width(1)
// mid.dotted(true)

// 0-line
let mid = w.line()
mid.at(null, 0)
mid.color('lightgrey')
mid.width(1)
mid.dotted(true)

w.y.fit(-40, 40);
w.x.fit('Jan 1 2018', 'Dec 31 2018');

let num = w.text(w.state.lat)
num.at('50%', '50%')


//make slider
let slider = w.slider({
  max: 50,
  min: -50,
  value: 37,
  id: 'lat'
})
slider.title('Latitude:')
let labels = Object.keys(latitudes)
console.log(labels)
labels = labels.map((v) => {
  let str = v + '°  ' + latitudes[v].city
  return [str, v]
})
slider.labels(labels)
// slider.callback = function(e) {
//   console.log('hi')
//   console.log(e.target.value)
//   stage.innerHTML = w.build()
// }


// console.log(w.state.lat)
// let label = w.text('cool' + w.state.lat).at('50%', '50%')
// label.bind('lat')

stage.innerHTML = w.build()
document.querySelector('#slider').innerHTML = slider.build()
