import wtf from 'wtf_wikipedia'
import api from 'wtf-plugin-api'
wtf.plugin(api)

let docs = await wtf.getCategoryPages('Line 6 Finch West stations')
docs = docs.map(o => o.title)//.slice(0, 3)
docs = await wtf.fetchList(docs)
docs.forEach(doc => {
  let geo = doc.coordinates()[0] || {}
  let r = {
    title: doc.title(),
    geo: { lat: geo.lat, lon: geo.lon }
  }
  console.log(r, ',')
})