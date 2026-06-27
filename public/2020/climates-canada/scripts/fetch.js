const wtf = require('wtf_wikipedia')
let city = 'Calgary'
// wtf.fetch(`Template:${city} weatherbox`).then((doc) => {
wtf.fetch(city).then((doc) => {
  let tmpl = doc.templates('weather box')[0]
  let months = tmpl.byMonth['mean c']
  console.log(months)
})
