import data from '../../data/stops/line-6.js'
import wards from './../../data/wards.js'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'


const findWard = function (geo) {
  let pt = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [geo.lon, geo.lat],
    },
  }
  for (let i = 0; i < wards.features.length; i += 1) {
    let poly = wards.features[i]
    if (booleanPointInPolygon(pt, poly)) {
      return poly.properties.AREA_DESC.replace(/ \(.*/, '')
    }
  }
  return null
}
// console.log(findWard({ lng: -79.31569, lat: 43.79574 }))
let json = data.map(o => {
  o.ward = findWard(o.geo)
  return o
})


// const topk = function (arr) {
//   let obj = {}
//   arr.forEach(a => {
//     obj[a] = obj[a] || 0
//     obj[a] += 1
//   })
//   let res = Object.keys(obj).map(k => [k, obj[k]])
//   return res.sort((a, b) => (a[1] > b[1] ? -1 : 0))
// }

// console.log(JSON.stringify(topk(json.map(o => o.ward)), null, 2))
console.log(JSON.stringify(json, null, 2))