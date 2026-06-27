const wtf = require('wtf_wikipedia')
let city = 'Quebec city'
// wtf.fetch(`Template:${city} weatherbox`).then((doc) => {
wtf.fetch(city).then((doc) => {
  let tmpl = doc.templates('weather box')[0]
  let months = tmpl.byMonth['snow cm']
  console.log(months)
})
