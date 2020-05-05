const zones = require('/Users/spencer/mountain/spacetime/zonefile/iana.js')
const byOffset = {}

const titleCase = (str) => {
  return str.charAt(0).toUpperCase() + str.substr(1)
}

Object.keys(zones).forEach((k) => {
  if (zones[k].dst) {
    let offset = String(zones[k].offset)
    byOffset[offset] = byOffset[offset] || {}
    byOffset[offset][zones[k].dst] = byOffset[offset][zones[k].dst] || []
    byOffset[offset][zones[k].dst].push(k)
  }
})
let result = Object.keys(byOffset).map((offset) => {
  return {
    offset: Number(offset),
    times: Object.keys(byOffset[offset]).map((time) => {
      let split = time.split(/->/)
      let cities = byOffset[offset][time].map((iana) => {
        let city = iana.split(/\//)[1]
        return titleCase(city).replace(/_/g, ' ')
      })
      return {
        start: split[0].replace(/:.*/, ''),
        end: split[1].replace(/:.*/, ''),
        zones: cities,
      }
    }),
  }
})
console.log(JSON.stringify(result, null, 2))
