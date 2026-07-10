// hand-port of the pieces of somehow-graph v0.3.6 this chart uses
// (linear scale, number ticks, month ticks) — parseInt truncations kept for pixel-fidelity
import spacetime from 'spacetime'

// pin dates to Ontario time so server + client render identically
const TZ = 'Canada/Eastern'
export const epoch = (str) => spacetime(str, TZ).epoch

// somehow-graph's tiny scaleLinear — truncates to whole viewBox units
export const scaleLinear = ({ world, minmax }) => (num) => {
  const percent = (num - minmax[0]) / (minmax[1] - minmax[0])
  return parseInt((world[1] - world[0]) * percent, 10)
}

// 33000 -> '33k'
const prettyNum = (num) => {
  if (num >= 10000) return parseInt(num / 1000, 10) + 'k'
  if (num >= 1000) return (parseInt(num / 100, 10) * 100) / 1000 + 'k'
  return num.toLocaleString()
}

// drop every-other tick until <= n remain
const reduceTo = (arr, n) => {
  while (arr.length > n && arr.length > 5) {
    arr = arr.filter((_, i) => i % 2 === 0)
  }
  return arr
}

// somehow-ticks: candidates every half-unit — a 0-100k range lands in the 'thousands' unit
// gives 1k / 33k / 65k / 97k
export const numTicks = (min, max, n = 6, unit = 1000) => {
  let ticks = []
  for (let val = Math.floor((min + unit) / unit) * unit; val < max; val += unit / 2) {
    ticks.push(val)
  }
  ticks = reduceTo(ticks, n)
  return ticks.map((t) => ({
    label: prettyNum(t),
    value: parseInt(((t - min) / (max - min)) * 1000, 10) / 1000, // 0-1, 3 decimals
  }))
}

// spacetime-ticks (months method, right for a ~2yr span):
// one candidate per month-start, reduced — gives Jan 2020 / Sep 2020 / May 2021 / Jan 2022
export const monthTicks = (startStr, endStr, n = 6) => {
  let start = spacetime(startStr, TZ)
  const end = spacetime(endStr, TZ)
  if (start.time() === '12:00am') start = start.minus(1, 'minute') // original's midnight nudge
  const ticks = []
  let s = start.add(1, 'month').startOf('month')
  while (s.isBefore(end)) {
    ticks.push(s)
    s = s.add(1, 'month')
  }
  const delta = end.epoch - start.epoch
  const fmt = start.isSame(end, 'year') ? '{month-short} {date}' : '{month-short} {year}'
  return reduceTo(ticks, n).map((t) => ({
    label: t.format(fmt),
    value: parseInt(((t.epoch - start.epoch) / delta) * 1000, 10) / 1000,
  }))
}
