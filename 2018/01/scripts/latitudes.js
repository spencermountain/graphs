// let cities = require('../../02/data/cities-total')
const wtf = require('wtf_wikipedia')
let sportsTowns = Object.keys(require('../data/cities'))
// cities = cities.reduce((h, o) => {
//   if (sportsTowns[o.title]) {
//     h[o.title] = parseInt(o.lat, 10)
//   }
//   return h
// }, {})
//
// console.log(JSON.stringify(cities, null, 2))
// sportsTowns = sportsTowns.slice(0, 3)
wtf.fetch(sportsTowns, (err, docs) => {
  let result = {}
  docs.forEach((doc) => {
    result[doc.title()] = null
    //get geolocation
    let coord = doc.coordinates(0)
    if (coord) {
      result[doc.title()] = parseInt(coord.lat, 10)
    }
  })
  console.log(JSON.stringify(result, null, 2))
})
