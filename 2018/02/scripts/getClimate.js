const wtf = require('/Users/spencer/mountain/wtf_wikipedia/')
let cities = require('../data/cities-population')
cities = cities.map((c) => c.city)
// cities = cities.slice(4, 6)

const parseBox = function(doc) {
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
  return byMonth
}

// wtf.fetch(cities, (err, docs) => {
//   let data = docs.map((doc) => {
//     let result = {
//       title: doc.title(),
//     }
//     //get geolocation
//     let coord = doc.coordinates(0)
//     if (coord) {
//       result.lat = coord.lat
//       result.lon = coord.lon
//     }
//     result.weather = parseBox(doc)
//   })
//   console.log(JSON.stringify(data, null, 2))
// })

// let missing = [
//   'Seoul',
//   'Cairo',
//   'Shanghai',
//   'Delhi',
//   'New York City',
//   'Guangzhou',
//   'Mumbai',
//   'Beijing',
//   'Karachi',
//   'Kolkata',
//   'Lahore',
//   'Chicago',
//   'London',
//   'Chennai',
//   'Hong Kong',
//   'Hyderabad',
//   'Philadelphia',
//   'Toronto',
//   'Singapore',
//   'Sydney',
//   'Dallas',
//   'Johannesburg',
//   'Phoenix, Arizona',
//   'Milan',
//   'San Diego',
//   'San Antonio',
//   'Peshawar',
//   'Islamabad',
//   'Tabriz',
//   'Sofia',
//   'Caloocan',
//   'Kawasaki, Kanagawa',
//   'Quanzhou'
// ]
// missing = missing.map((city) => `Template:${city} weatherbox`)
// wtf.fetch(missing, (err, docs) => {
//   let data = docs.map((doc) => {
//     return {
//       title: doc.title(),
//       weather: parseBox(doc)
//     }
//   })
//   console.log(JSON.stringify(data, null, 2))
// })

//combine the two data-sets
let allCities = require('../data/cities-weather')
const more = require('../data/cities-more-weather')
allCities.forEach((o) => {
  if (!o.lat) {
    console.log(o.title + ' geo')
  }
  if (Object.keys(o.weather).length === 0) {
    let w = more.find((m) => m.title === o.title)
    if (!w) {
      console.log(o.title + ' - weather')
    } else {
      o.weather = w.weather
    }
  }
})
console.log(JSON.stringify(allCities, null, 2))
