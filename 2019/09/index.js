const somehow = require('somehow')
// const somehow = require('/Users/spencer/mountain/somehow/src')
const spacetime = require('spacetime')
const SunCalc = require('suncalc')
const inputs = require('somehow-input')
const getTable = require('./table')
const byDay = require('./byDay')

let date = new Date()
const year = date.getFullYear()

const summerSolstice = function(lat) {
  let d = new Date('July 21 ' + year)
  let obj = SunCalc.getTimes(d, lat, -0.1)
  let minutes = spacetime(obj.sunrise).diff(obj.sunset).minutes
  return minutes / 60
}
const winterSolstice = function(lat) {
  let d = new Date('Dec 21 ' + year)
  let obj = SunCalc.getTimes(d, lat, -0.1)
  let minutes = spacetime(obj.sunrise).diff(obj.sunset).minutes
  return minutes / 60
}

const getByWeek = function(lat) {
  let months = []
  let s = spacetime('Jan 1 ' + year)
  for (let i = 0; i <= 52; i++) {
    let obj = SunCalc.getTimes(s.d, lat, 0)
    let minutes = spacetime(obj.sunrise).diff(obj.sunset).minutes
    months.push([s.iso(), minutes / 60])
    s = s.add(1, 'week')
  }
  return months
}
const getByMonth = function(lat) {
  let months = []
  let s = spacetime('Jan 1 ' + year)
  for (let i = 0; i < 12; i++) {
    let obj = SunCalc.getTimes(s.d, lat, 0)
    let minutes = spacetime(obj.sunrise).diff(obj.sunset).minutes
    months.push([s.iso(), minutes / 60])
    s = s.add(1, 'month')
  }
  return months
}

const drawGraph = function(lat) {
  let byMonth = getByMonth(lat)
  document.querySelector('#table').innerHTML = getTable(byMonth)
  document.querySelector('#byDay').innerHTML = byDay(lat, year)

  let byWeek = getByWeek(lat)
  let w = somehow({
    height: 200,
    aspect: 'widescreen'
  })

  // w.line()
  //   .color('lightgrey')
  //   .width(1)
  //   .dotted()
  //   .set(getLatitude(60))
  // w.line()
  //   .color('lightgrey')
  //   .width(1)
  //   .dotted()
  //   .set(getLatitude(-60))
  let jan = byWeek[0][1]
  let aug = byWeek[26][1]

  w.line()
    .color('grey')
    .width(1)
    .set([['June 21 ' + year, jan], ['June 21 ' + year, aug]])

  let max = summerSolstice(lat)
  let min = winterSolstice(lat)
  let maxDiff = max - min
  w.text(Math.abs(maxDiff.toFixed(1)) + 'hr diff')
    .color('lightgrey')
    .set([['June 21 ' + year, 2]])
    .dy(-3)

  let line = w
    .area()
    .soft()
    .color('sky')
    .opacity(0.3)
  line.set(byWeek)

  w.line()
    .dotted()
    .color('grey')
    .width(1)
    .set([['Jan 1 ' + year, jan], ['Dec 30 ' + year, jan]])
  w.line()
    .dotted()
    .color('grey')
    .width(1)
    .set([['Jan 1 ' + year, aug], ['Dec 30 ' + year, aug]])

  w.x.fit()
  w.y.fit(0, 24)
  w.xAxis.remove()
  // w.xAxis.ticks(12)
  w.yAxis.ticks(12)
  document.querySelector('#graph').innerHTML = w.build()
}
drawGraph(43)

let slider = inputs.vslider({
  width: 600,
  max: 60,
  min: -60,
  value: 40,
  label: 'latitude',
  debounce: false,
  reverse: false,
  cb: val => {
    console.log(val)
    drawGraph(val)
  }
})
document.querySelector('#slider').innerHTML = slider.build()
