const wtf = require('/Users/spencer/mountain/wtf_wikipedia/')
let cities = require('../data/cities-population')
cities = cities.map((c) => c.city)
// cities = cities.slice(4, 6)

wtf.fetch(cities, (err, docs) => {
  let data = docs.map((doc) => {
    let result = {
      title: doc.title(),
    }
    //get geolocation
    let coord = doc.coordinates(0)
    if (coord) {
      result.lat = coord.lat
      result.lon = coord.lon
    }

    let tmpl = doc.templates('weather box') || []
    if (tmpl.length === 0) {
      console.log(doc.title())
    }
    tmpl = tmpl[0] || {}
    let byMonth = tmpl.byMonth || {}
    delete byMonth['high c']
    delete byMonth['high f']
    delete byMonth['low c']
    delete byMonth['low f']
    delete byMonth['record high c']
    delete byMonth['record high f']
    delete byMonth['record low c']
    delete byMonth['record low f']
    Object.keys(byMonth).forEach((k) => {
      if (Array.isArray(byMonth[k]) === true) {
        byMonth[k] = byMonth[k].join(',')
      }
    })
    result.weather = byMonth
    return result
  })
  console.log(JSON.stringify(data, null, 2))
})
