

const cleanup = function (json) {
  json = json.filter(o => {
    if (!o.DWELLING_UNITS_CREATED || o.DWELLING_UNITS_CREATED === "0") {
      return false
    }
    if (o.STATUS !== "Closed") {
      return false
    }
    let delta_units = o.DWELLING_UNITS_CREATED - (o.DWELLING_UNITS_LOST || 0)
    if (delta_units <= 0) {
      return false
    }
    return true
  })
  json = json.map(o => {
    o.type = 'res'
    if (o.DWELLING_UNITS_CREATED <= 1) {
      o.type = 'res'
    } else if (o.DWELLING_UNITS_CREATED <= 12) {
      o.type = 'middle'
    } else if (o.DWELLING_UNITS_CREATED > 12) {
      o.type = 'condo'
    }
    return o
  })
  return json
}
export default cleanup