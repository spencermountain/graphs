import patterns from '../../zonefile/patterns.js'
import zones from '../../zonefile/zonefile.2022.js'
import misc from '../../zonefile/misc.js'
import calc from './calculate.js'

const hour = 1000 * 60 * -60

// calculate DST times, for this timezone
const getDst = function (tz, year) {
  let { pattern, offset } = zones[tz] || {}
  // allow ad-hoc dst settings
  if (misc.hasOwnProperty(pattern) && misc[pattern][String(year)]) {
    let [start, end] = misc[pattern][String(year)]
    return { start, end }
  }

  let changes = []

  let obj = patterns[pattern]
  if (!obj) {
    return changes
  }
  // get epoch for spring dst change
  let res = calc(obj.start, year, offset)
  changes.push({
    epoch: res.epoch - hour,
    cal: {
      year,
      month: res.month,
      date: res.date,
      hour: obj.start.hour,
      minute: 0,
      offset: offset - 1,
      epoch: res.epoch - hour
    }
  })

  // get epoch for fall dst change
  res = calc(obj.end, year, offset)
  changes.push({
    epoch: res.epoch,
    cal: {
      year,
      month: res.month,
      date: res.date,
      hour: obj.end.hour,
      minute: 0,
      offset,
      epoch: res.epoch,
    }
  })
  return changes
}

export default getDst

// console.log(getDst('America/Toronto', 2023))