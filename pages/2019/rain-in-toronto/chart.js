// per-year chart layout, ported from the somehow bundle in public/2019/rain-in-toronto
export const W = 470 // somehow({height:200, aspect:'widescreen'}) -> 2.35:1
export const H = 200
export const Y_MAX = 3 // w.y.fit(0, 3) — big storms poke above the frame (overflow visible)
export const BAR_W = 5

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const monthDays = (y) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// "YYYY-MM-DD" -> zero-based day of year (no Date(); SSR-safe)
const dayOfYear = function (str) {
  let [y, m, d] = str.split('-').map(Number)
  let days = monthDays(y)
  let n = d - 1
  for (let i = 0; i < m - 1; i += 1) {
    n += days[i]
  }
  return n
}

// somehow's tiny scaleLinear truncated positions to whole pixels
export function yearChart(days, year) {
  const total = isLeap(year) ? 366 : 365 // x always spans Jan 1 → Dec 31
  const x = (doy) => Math.trunc((W * doy) / (total - 1))
  const y = (v) => Math.trunc((H * (Y_MAX - v)) / Y_MAX) // negative when v > 3
  const bars = []
  const dots = []
  days.forEach((d) => {
    const px = x(dayOfYear(d.date))
    if (d.rain) {
      bars.push({ x: px, y: y(d.rain), h: H - y(d.rain), date: d.date })
    }
    if (d.thunder) {
      dots.push(px)
    }
  })
  // 6 even ticks across the year, labeled with the month name — Jan Mar May Aug Oct Dec
  const ticks = [0, 1, 2, 3, 4, 5].map((i) => {
    const doy = ((total - 1) * i) / 5
    const mLens = monthDays(year)
    let m = 0
    let sum = 0
    while (sum + mLens[m] <= doy) {
      sum += mLens[m]
      m += 1
    }
    return { x: x(doy), label: MONTHS[m] }
  })
  return { year, bars, dots, ticks }
}
