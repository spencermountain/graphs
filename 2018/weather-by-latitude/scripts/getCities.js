const wtf = require('/Users/spencer/mountain/wtf_wikipedia/')

wtf.fetch('List_of_largest_cities', (err, doc) => {
  let table = doc.section('largest cities').tables(0)
  let cities = table.json().map((o) => {
    let num = null
    if (o['Urban area']) {
      num = o['Urban area'].number || o['Urban area'].text
    }
    if (!num && o['Metropolitan area']) {
      num = o['Metropolitan area'].number || o['Metropolitan area'].text
    }
    if (!num && o['City proper']) {
      num = o['City proper'].number || o['City proper'].text
    }
    if (!num) {
      console.log(o)
    }
    let city = ''
    if (o.City.links) {
      city = o.City.links[0].page
    }
    return {
      city: city,
      country: o.Nation.text,
      population: num
    }
  })
  cities = cities.sort((a, b) => a.population < b.population ? 1 : -1)
  console.log(JSON.stringify(cities, null, 2))

})
