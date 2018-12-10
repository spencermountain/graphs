let cities = require('../data/cities-weather')
const population = require('../data/cities-population')
const isInch = / inch$/
const isF = / f$/

// New York City
// Mumbai
// Beijing
// Tehran
// Kano
// Chennai
// Bangalore
// Ahmedabad
// Vijayawada
// Visakhapatnam
// Dallas
// Houston
// Surat
// Guatemala City
// Dar es Salaam
// Medan
// Phoenix, Arizona
// Faisalabad
// Semarang
// Campinas
// Jaipur
// San Diego
// Kanpur
// Lucknow
// Ouagadougou
// Dakar
// San Antonio
// Abuja
// Birmingham
// Brisbane
// Makassar
// Bhopal
// Hyderabad, Pakistan
// Tabriz
// Caloocan
// Kawasaki, Kanagawa
// Quanzhou
// Allahabad

function toCelsious(f) {
  let c = (f - 32) * (5 / 9);
  c = parseInt(c * 100, 10) / 100
  return c
}
function toCentimetres(inch) {
  let cm = inch * 2.54
  cm = parseInt(cm * 100, 10) / 100
  return cm
}


cities.forEach((c) => {
  //add population
  let o = population.find(p => p.city === c.title)
  c.population = o.population
  c.country = o.country
  let keys = Object.keys(c.weather)
  keys.forEach((k) => {
    //convert inches to cm
    if (isInch.test(k)) {
      let key = k.replace(isInch, ' cm')
      c.weather[key] = c.weather[k].split(',').map(toCentimetres).join(',')
      delete c.weather[k]
    }
    //convert inches to cm
    if (isF.test(k)) {
      let key = k.replace(isF, ' c')
      c.weather[key] = c.weather[k].split(',').map(toCelsious).join(',')
      delete c.weather[k]
    }

  })
  //calculate rough median
  if (!c.weather['mean c']) {
    // x += 1
    console.log(c.title)
  }
})

cities = cities.sort((a, b) => a.population < b.population ? 1 : -1)

console.log(JSON.stringify(cities, null, 2))
