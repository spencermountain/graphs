const spacetime = require('spacetime');
const got = require('got')
const API_KEY = 'd15db3dda663a76c0a93fad2037e0deb' //make your own, i don't care.
const latlng = '43.6529,-79.3849' //toronto
const timezone = 'Canada/Eastern'
const days = []
// let daysAgo = 14 //duration to look back

const fetch = function(daysAgo, cb) {

  let time = spacetime.now(timezone).subtract(daysAgo, 'days')
  let day = time.format()
  time = parseInt(time.epoch / 1000, 10)
  const url = `https://api.darksky.net/forecast/${API_KEY}/${latlng},${time}?exclude=hourly,currently,minutely,flags,alerts&units=ca`
  console.log(url)
  got(url).then(r => {
    try {
      let data = JSON.parse(r.body)
      let dayData = data.daily.data[0]
      days.push({
        day: day,
        ozone: dayData.ozone,
        precip: dayData.precipAccumulation || 0,
        precipType: dayData.precipType,
        clouds: dayData.cloudCover || 0,
        humidity: dayData.humidity || 0,
        pressure: dayData.pressure,
        temperatureMin: dayData.temperatureMin,
        temperatureMax: dayData.temperatureMax,
      })
    } catch (e) {
      console.log(e)
    }
    if (daysAgo < 1) {
      return cb()
    } else {
      daysAgo -= 1
      return fetch(daysAgo, cb)
    }
  })

}

fetch(3, () => {
  console.log('module.exports=' + JSON.stringify(days, null, 2))
})
