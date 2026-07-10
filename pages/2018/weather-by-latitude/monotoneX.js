// d3-shape's curveMonotoneX (Fritsch-Carlson), ported by hand.
// takes [[x,y],...] pixel points, returns an svg path string.
const sign = (x) => (x < 0 ? -1 : 1)

const monotoneX = (pts) => {
  let d = ''
  let x0 = NaN
  let y0 = NaN
  let x1 = NaN
  let y1 = NaN
  let t0 = NaN
  let state = 0 // how many points seen (capped at 3)

  // cubic segment from (x0,y0) to (x1,y1) with tangents ta, tb
  const bezier = (ta, tb) => {
    const dx = (x1 - x0) / 3
    d += `C${x0 + dx},${y0 + dx * ta},${x1 - dx},${y1 - dx * tb},${x1},${y1}`
  }
  // three-point slope estimate around (x1,y1)
  const slope3 = (x2, y2) => {
    const h0 = x1 - x0
    const h1 = x2 - x1
    const s0 = (y1 - y0) / (h0 || (h1 < 0 && -0))
    const s1 = (y2 - y1) / (h1 || (h0 < 0 && -0))
    const p = (s0 * h1 + s1 * h0) / (h0 + h1)
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  // one-sided slope estimate at an endpoint
  const slope2 = (t) => {
    const h = x1 - x0
    return h ? ((3 * (y1 - y0)) / h - t) / 2 : t
  }

  pts.forEach(([x, y]) => {
    let t1 = NaN
    if (x === x1 && y === y1) return // skip repeated point
    if (state === 0) {
      state = 1
      d += `M${x},${y}`
    } else if (state === 1) {
      state = 2
    } else if (state === 2) {
      state = 3
      t1 = slope3(x, y)
      bezier(slope2(t1), t1)
    } else {
      t1 = slope3(x, y)
      bezier(t0, t1)
    }
    x0 = x1
    y0 = y1
    x1 = x
    y1 = y
    t0 = t1
  })
  // line end
  if (state === 2) {
    d += `L${x1},${y1}`
  } else if (state === 3) {
    bezier(t0, slope2(t0))
  }
  return d
}

export default monotoneX
