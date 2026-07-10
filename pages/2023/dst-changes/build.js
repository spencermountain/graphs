// computes DST start/end epochs for each timezone in a given year
// ported from public/2023/dst-changes/lib/ (compute/changes + _lib)
import patterns from './patterns.js'
import zones from './zonefile.js'
import misc from './misc.js'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const YEAR = 365 * DAY
const LEAPYEAR = YEAR + DAY

const isLeap = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// get UTC epoch for jan 1
let memo = {}
const getStart = function (year) {
  if (memo.hasOwnProperty(year)) {
    return memo[year]
  }
  let n = 0
  for (let y = 1970; y < year; y += 1) {
    n += isLeap(y) ? LEAPYEAR : YEAR
    memo[year] = n
  }
  return n
}

// which day of the week is it? ('key-value method')
const monthCodes = [null, 0, 3, 3, 6, 1, 4, 6, 2, 5, 0, 3, 5]
const centuryCodes = { 17: 4, 18: 2, 19: 0, 20: 6, 21: 4, 22: 2, 23: 0 }
const getDay = function (year, month, date) {
  let yy = year % 100
  let yc = (yy + parseInt(yy / 4, 10)) % 7
  let c = parseInt(year / 100, 10)
  let cc = year < 1752 ? 18 - (c % 7) : centuryCodes[String(c)] || 0
  let lc = isLeap(year) ? -1 : 0
  return (yc + monthCodes[month] + cc + date + lc) % 7
}

// ms from jan 1 to the start of this month
const addMonths = function (months, year) {
  let ms = 0
  for (let i = 0; i < months - 1; i += 1) {
    let days = monthLengths[i]
    if (i === 1 && isLeap(year)) {
      days = 29
    }
    ms += days * DAY
  }
  return ms
}

// click forward to the proper weekday
const toWeekDay = function (obj, year) {
  let day = getDay(year, obj.month, 1)
  let want = obj.day
  let diff = 0
  for (let i = 0; i < 7; i += 1) {
    if (day === want) {
      return diff
    }
    day = (day + 1) % 7
    diff += 1
  }
  return 0
}

// jump to '2nd', 'last'.. week of the month
const toRightWeek = function (num, day, month) {
  if (num === 'first' || num <= 1) {
    return 0
  }
  if (num === 'last') {
    let max = monthLengths[month + 1] || 31
    let days = 0
    for (let i = 0; i < 5; i += 1) {
      days += 7
      if (days + day >= max) {
        return days - 7 // went too far
      }
    }
    return 3
  }
  return (num - 1) * 7
}

// epoch for eg. '2nd sunday of march, 2am' in this year+offset
const calc = function (obj, year, offset) {
  let date = 1
  let month = obj.month
  let epoch = getStart(year)
  // go to the correct month
  epoch += addMonths(obj.month, year)
  // go to the correct day
  let days = toWeekDay(obj, year)
  date += days
  epoch += days * DAY
  // go to the correct week
  days = toRightWeek(obj.num, days, obj.month)
  epoch += days * DAY
  date += days
  // go to the correct hour
  epoch += (obj.hour || 0) * HOUR
  // go to the correct offset
  epoch -= offset * 60 * 60 * 1000
  return { epoch, month, date }
}

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
  // epoch for spring dst change
  let res = calc(obj.start, year, offset)
  changes.push({
    epoch: res.epoch - hour,
    cal: { year, month: res.month, date: res.date, hour: obj.start.hour, minute: 0, offset: offset - 1, epoch: res.epoch - hour },
  })
  // epoch for fall dst change
  res = calc(obj.end, year, offset)
  changes.push({
    epoch: res.epoch,
    cal: { year, month: res.month, date: res.date, hour: obj.end.hour, minute: 0, offset, epoch: res.epoch },
  })
  return changes
}

// all timezones with a dst change this year
const doYear = function (year) {
  let out = []
  Object.keys(zones).forEach((tz) => {
    let changes = getDst(tz, year)
    if (changes[0] && changes[1]) {
      let arr = tz.split(/\//)
      out.push({
        tz,
        name: arr[arr.length - 1],
        start: changes[0].cal,
        end: changes[1].cal,
      })
    }
  })
  return out
}
export default doYear
