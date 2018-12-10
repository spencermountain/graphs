const cities = require('../data/cities-weather')
const population = require('../data/cities-population')

const latitudes = {}
cities.forEach((c) => {
  let lat = Number(c.lat)
  lat = parseInt(lat, 10)
  lat = parseInt(lat / 10, 10) * 10
  latitudes[lat] = latitudes[lat] || []
  latitudes[lat].push({
    city: c.title,
    weather: c.weather['mean c']
  })
})

console.log(latitudes)
