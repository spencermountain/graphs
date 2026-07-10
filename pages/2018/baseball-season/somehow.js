// hand-port of the bits of `somehow` v0.0.8 (spencermountain) this post used:
// truncating linear scales, d3's curveMonotoneX line path, and default axis ticks.

export const W = 800
export const H = 200

// -- date parsing (deterministic UTC; original used spacetime in browser tz) --
const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
export const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// handles 'March 29 2018', 'Aug 2 2018', 'April 28  2018' (double-space)
export const parseDate = (str) => {
  const m = str.match(/^([A-Za-z]+)\s+(\d+),?\s+(\d+)$/)
  return Date.UTC(Number(m[3]), months[m[1].slice(0, 3).toLowerCase()], Number(m[2]))
}

// -- scales (original scaleLinear did parseInt() on the result) --
export const xScale = (min, max) => (n) => Math.trunc((W * (n - min)) / (max - min))
// y is flipped: minmax was [max, min]
export const yScale = (min, max) => (n) => Math.trunc((H * (n - max)) / (min - max))

// -- d3-shape curveMonotoneX line generator, ported --
const sign = (x) => (x < 0 ? -1 : 1)

export const monotoneX = (points) => {
  let d = ''
  let x0, y0, x1, y1, t0
  let state = 0 // how many points seen (caps at 3)
  const bez = (ta, tb) => {
    const dx = (x1 - x0) / 3
    d += `C${x0 + dx},${y0 + dx * ta},${x1 - dx},${y1 - dx * tb},${x1},${y1}`
  }
  const slope3 = (x2, y2) => {
    const h0 = x1 - x0
    const h1 = x2 - x1
    const s0 = (y1 - y0) / (h0 || (h1 < 0 && -0))
    const s1 = (y2 - y1) / (h1 || (h0 < 0 && -0))
    const p = (s0 * h1 + s1 * h0) / (h0 + h1)
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  const slope2 = (t) => {
    const h = x1 - x0
    return h ? ((3 * (y1 - y0)) / h - t) / 2 : t
  }
  points.forEach(([x, y]) => {
    let t1 = NaN
    if (x === x1 && y === y1) return // skip coincident points
    if (state === 0) {
      state = 1
      d += `M${x},${y}`
    } else if (state === 1) {
      state = 2
    } else if (state === 2) {
      state = 3
      bez(slope2((t1 = slope3(x, y))), t1)
    } else {
      bez(t0, (t1 = slope3(x, y)))
    }
    x0 = x1
    x1 = x
    y0 = y1
    y1 = y
    t0 = t1
  })
  if (state === 2) d += `L${x1},${y1}` // only two points -> straight segment
  if (state === 3) bez(t0, slope2(t0)) // close out final segment
  return d
}

// -- default axis ticks (6 each, evenly spaced across the domain) --
export const xTicks = (min, max, scale) => {
  const out = []
  for (let i = 0; i <= 5; i += 1) {
    const num = (i / 5) * (max - min) + min
    out.push({ pos: scale(num), label: monthNames[new Date(num).getUTCMonth()] }) // 'MMM' fmt
  }
  return out
}

export const yTicks = (min, max, scale) => {
  const out = []
  for (let i = 0; i <= 5; i += 1) {
    const num = (i / 5) * (max - min) + min
    out.push({ pos: scale(num), label: String(num) })
  }
  return out
}
