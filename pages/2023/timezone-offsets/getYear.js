// ported from the 2023 original's lib/compute chain (prepYear → by-year → calculate → _lib)
import zonefile from './zonefile.js'
import patterns from './patterns.js'
import misc from './misc.js'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const YEAR = 365 * DAY
const LEAPYEAR = YEAR + DAY

const isLeap = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// utc epoch for jan 1st of the year (memoized)
let memo = {}
const getStart = function (year) {
  if (memo.hasOwnProperty(year)) {
    return memo[year]
  }
  let n = 0
  for (let y = 1970; y < year; y += 1) {
    n += isLeap(y) ? LEAPYEAR : YEAR
  }
  memo[year] = n
  return n
}

// day-of-week using the 'key-value method'
// https://artofmemory.com/blog/how-to-calculate-the-day-of-the-week/
const monthCodes = [null, 0, 3, 3, 6, 1, 4, 6, 2, 5, 0, 3, 5]
const centuryCodes = { 17: 4, 18: 2, 19: 0, 20: 6, 21: 4, 22: 2, 23: 0 }
const getDay = function (year, month, date) {
  let yy = year % 100
  let yearCode = (yy + parseInt(yy / 4, 10)) % 7
  let c = parseInt(year / 100, 10)
  let centuryCode = year < 1752 ? 18 - (c % 7) : centuryCodes[String(c)] || 0 // julian before 1752
  let leapCode = isLeap(year) ? -1 : 0
  return (yearCode + monthCodes[month] + centuryCode + date + leapCode) % 7
}

// ms for the months before this one
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
  let diff = 0
  for (let i = 0; i < 7; i += 1) {
    if (day === obj.day) {
      return diff
    }
    day = (day + 1) % 7
    diff += 1
  }
  return 0
}

// jump to the proper week of the month
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

// epoch for a rule like '2nd-sun-mar-2h' in a given year + offset
const calc = function (obj, year, offset) {
  let date = 1
  let epoch = getStart(year)
  epoch += addMonths(obj.month, year) // go to the correct month
  let days = toWeekDay(obj, year) // go to the correct day
  date += days
  epoch += days * DAY
  days = toRightWeek(obj.num, days, obj.month) // go to the correct week
  epoch += days * DAY
  date += days
  epoch += (obj.hour || 0) * HOUR // go to the correct hour
  epoch -= offset * HOUR // go to the correct offset
  return { epoch, month: obj.month, date }
}

const hour = 1000 * 60 * -60

// calculate spring + fall dst changes, for this timezone
const getDst = function (tz, year) {
  let { pattern, offset } = zonefile[tz] || {}
  // ad-hoc dst years (lunar-calendar zones) return raw epochs — dropped below, as in the original
  if (misc.hasOwnProperty(pattern) && misc[pattern][String(year)]) {
    let [start, end] = misc[pattern][String(year)]
    return { start, end }
  }
  let changes = []
  let obj = patterns[pattern]
  if (!obj) {
    return changes
  }
  // spring dst change
  let res = calc(obj.start, year, offset)
  changes.push({
    epoch: res.epoch - hour,
    cal: { year, month: res.month, date: res.date, hour: obj.start.hour, minute: 0, offset: offset - 1, epoch: res.epoch - hour },
  })
  // fall dst change
  res = calc(obj.end, year, offset)
  changes.push({
    epoch: res.epoch,
    cal: { year, month: res.month, date: res.date, hour: obj.end.hour, minute: 0, offset, epoch: res.epoch },
  })
  return changes
}

// every dst-observing timezone, with its two change-points for the year
const getYear = function (year) {
  let out = []
  Object.keys(zonefile).forEach((tz) => {
    let changes = getDst(tz, year)
    if (changes[0] && changes[1]) {
      let arr = tz.split('/')
      out.push({ tz, name: arr[arr.length - 1], start: changes[0].cal, end: changes[1].cal })
    }
  })
  return out
}
export default getYear
