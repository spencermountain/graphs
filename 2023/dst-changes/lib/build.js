import prepYear from './compute/changes/prepYear.js'
import zoneFile from './zonefile/zonefile.2022.js'

const doYear = function (year) {
  let structure = {}
  Object.keys(zoneFile).forEach(k => {
    prepYear(structure, k, year)
  })
  let out = Object.entries(structure).map(a => {
    let [tz, obj] = a
    let arr = tz.split(/\//)
    let name = arr[arr.length - 1]
    return {
      tz,
      name,
      start: obj.start,
      end: obj.end
    }
  })
  return out
}
export default doYear

console.log(doYear(2023))