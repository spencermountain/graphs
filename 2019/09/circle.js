const somehowCircle = require('somehow-circle')
const SunCalc = require('suncalc')
const spacetime = require('spacetime')
const getCity = require('./getCity')

const line1 = function(w, lat, year) {
  let d = new Date('July 21 ' + year)
  let summer = SunCalc.getTimes(d, lat, -0.1)
  let sunrise = spacetime(summer.sunrise).progress('day') * 100
  let sunset = spacetime(summer.sunset).progress('day') * 100
  if (sunrise > 90) {
    sunrise = sunrise - 100
  }
  w.arc()
    .from(sunrise)
    .to(sunset)
    .radius(50)
    .color('lightblue')
    .width(2)
    .dotted(1)
}
//winter
const line2 = function(w, lat, year) {
  let d = new Date('Dec 21 ' + year)
  let winter = SunCalc.getTimes(d, lat, -0.1)
  let sunrise = spacetime(winter.sunrise).progress('day') * 100
  let sunset = spacetime(winter.sunset).progress('day') * 100
  if (sunrise > 89) {
    sunrise = sunrise - 100
  }
  w.arc()
    .from(sunrise)
    .to(sunset)
    .radius(50)
    .color('blue')
    .width(2)
}

const circle = function(lat, year) {
  let w = somehowCircle()

  // simple circle
  w.circle().radius(50)

  // if (lat < -24) {
  //   line2(w, lat, year, 1)
  //   line1(w, lat, year, false)
  // } else {
  line1(w, lat, year)
  line2(w, lat, year)
  // }

  document.querySelector('#city').innerHTML = getCity(lat)

  //summer

  // if (length2 > length) {
  //   console.log('here')
  //   two.z(2)
  // }
  // console.log(length, length2)
  // let start = spacetime(winter.sunrise)
  // w.label(start.format('time'))
  //   .at(sunrise)
  //   .min(100)
  // w.text('midnight').rotate(30)
  // .at(95)

  w.rotate(-90)
  w.fit()
  w.xScale.fit(0, 100)

  document.querySelector('#circle').innerHTML = w.build()
}
module.exports = circle
