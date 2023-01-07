import byYear from './by-year.js'

const addYear = function (structure, tz, year) {

  let thisYear = byYear(tz, year)
  if (thisYear[0] && thisYear[1]) {

    structure[tz] = {
      start: thisYear[0].cal,
      end: thisYear[1].cal,
    }
  }

  return structure
}
export default addYear