const cities = require('../data/cities-total')

const latitudes = {}
cities.forEach((c) => {
  let lat = Number(c.lat)
  lat = parseInt(lat, 10)
  lat = parseInt(lat / 10, 10) * 10
  latitudes[lat] = latitudes[lat] || []
  latitudes[lat].push({
    city: c.title,
    population: c.population,
    weather: c.weather['mean c']
  })
})

let keys = Object.keys(latitudes).sort((a, b) => Number(a) < Number(b) ? -1 : 1)
keys.forEach((k) => {
  latitudes[k] = latitudes[k].sort((a, b) => a.population < b.population ? 1 : -1)
  latitudes[k] = latitudes[k].filter((o) => o.weather)
// newObj[k] = latitudes[k][0]
// latitudes[k].weather = latitudes[k].weather.split(',')
})

console.log(latitudes)
