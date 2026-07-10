// ported from somehow-calendar (src/_calc.js + src/_fmtDays.js)
import colors from '~/assets/colors.js'

// weeks of a month as spacetime days, monday-start, trailing weeks trimmed
export const calcMonth = function (date) {
  let start = date.startOf('month')
  let d = start.startOf('week') // monday
  let weeks = []
  for (let w = 0; w < 6; w += 1) {
    let week = []
    for (let i = 0; i < 7; i += 1) {
      week.push(d)
      d = d.add(1, 'day')
    }
    weeks.push(week)
    let sunday = week[week.length - 1]
    if (sunday.isSame(start, 'month') === false) {
      return weeks
    }
  }
  return weeks
}

// {isoDate: colorName} -> {iso-short: cssColor}
// keys are full ISO timestamps; slice the calendar-date part so ssr + all timezones agree
export const fmtDays = function (obj) {
  let res = {}
  Object.keys(obj).forEach((k) => {
    let iso = String(k).slice(0, 10)
    let color = obj[k]
    res[iso] = colors[color] || color
  })
  return res
}
