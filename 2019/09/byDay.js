const spacetime = require('spacetime')
const SunCalc = require('suncalc')

const getDay = function(s, lat) {
  let obj = SunCalc.getTimes(s.d, lat, 0)
  let mins = spacetime(obj.sunrise).diff(obj.sunset).minutes
  s = s.add(1, 'day')
  obj = SunCalc.getTimes(s.d, lat, 0)
  let nextDay = spacetime(obj.sunrise).diff(obj.sunset).minutes
  let diff = nextDay - mins
  if (diff > 0) {
    diff = '+' + diff
  }
  return diff
}
const getWeek = function(s, lat) {
  let obj = SunCalc.getTimes(s.d, lat, 0)
  let mins = spacetime(obj.sunrise).diff(obj.sunset).minutes
  s = s.add(1, 'week')
  obj = SunCalc.getTimes(s.d, lat, 0)
  let nextDay = spacetime(obj.sunrise).diff(obj.sunset).minutes
  let diff = nextDay - mins
  if (diff > 0) {
    diff = '+' + diff
  }
  return diff
}

const byDay = function(lat, year) {
  let fall = spacetime('Sept 22 ' + year)
  let fallDay = getDay(fall, lat)
  let fallWeek = getWeek(fall, lat)

  let spring = spacetime('march 20 ' + year)
  let springDay = getDay(spring, lat)
  let springWeek = getWeek(spring, lat)
  return `<table class="w100p center grey mt3">
  <tr class="underline">
    <td>spring Equinox</td>
    <td>fall Equinox</td>
  </tr>
  <tr>
    <td ><span class="f2">${springDay} mins</span> / day</td>
    <td ><span class="f2">${fallDay} mins</span> / day</td>
  </tr>
  <tr>
    <td ><span class="f2">${springWeek} mins</span> / week</td>
    <td ><span class="f2">${fallWeek} mins</span> / week</td>
  </tr>
  <table>`
}
module.exports = byDay
