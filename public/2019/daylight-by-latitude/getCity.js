const cities = require('./data/by-latitude')
const getCity = function(lat) {
  if (cities[lat]) {
    return cities[lat].city
  }
  for (let i = 0; i < 60; i++) {
    let n = lat + i
    if (cities[n]) {
      return cities[n].city
    }
    n = lat - i
    if (cities[n]) {
      return cities[n].city
    }
  }
  return null
}
module.exports = getCity
