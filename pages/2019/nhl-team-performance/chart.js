// hand-ported bits of the old 'somehow' chart lib (which wrapped d3)

// somehow's tiny scaleLinear — note it truncates to whole pixels
export const linear = (world, minmax) => (num) => {
  const percent = (num - minmax[0]) / (minmax[1] - minmax[0])
  return Math.trunc((world[1] - world[0]) * percent)
}

// d3-shape's curveMonotoneX, as a standalone svg-path builder
const sign = (x) => (x < 0 ? -1 : 1)
export const monotonePath = (pts) => {
  let d = ''
  let x0 = NaN, y0 = NaN, x1 = NaN, y1 = NaN, t0 = NaN
  let state = 0
  const bezier = (ta, tb) => {
    const dx = (x1 - x0) / 3
    d += `C${x0 + dx},${y0 + dx * ta},${x1 - dx},${y1 - dx * tb},${x1},${y1}`
  }
  // fritsch-carlson tangent at the middle of (x0,y0)-(x1,y1)-(x2,y2)
  const slope3 = (x2, y2) => {
    const h0 = x1 - x0
    const h1 = x2 - x1
    const s0 = (y1 - y0) / (h0 || (h1 < 0 && -0))
    const s1 = (y2 - y1) / (h1 || (h0 < 0 && -0))
    const p = (s0 * h1 + s1 * h0) / (h0 + h1)
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  // one-sided tangent at an endpoint
  const slope2 = (t) => {
    const h = x1 - x0
    return h ? (3 * (y1 - y0) / h - t) / 2 : t
  }
  for (const [x, y] of pts) {
    let t1 = NaN
    if (x === x1 && y === y1) continue
    if (state === 0) {
      state = 1
      d += `M${x},${y}`
    } else if (state === 1) {
      state = 2
    } else if (state === 2) {
      state = 3
      bezier(slope2((t1 = slope3(x, y))), t1)
    } else {
      bezier(t0, (t1 = slope3(x, y)))
    }
    x0 = x1; x1 = x
    y0 = y1; y1 = y
    t0 = t1
  }
  if (state === 2) d += `L${x1},${y1}` // only two points → straight line
  else if (state === 3) bezier(t0, slope2(t0))
  return d
}
