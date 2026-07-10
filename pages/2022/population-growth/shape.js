// minimal port of d3-shape's area() + curveMonotoneX (Fritsch–Carlson monotone cubic)
// writes svg path strings directly, instead of a canvas-style context
const sign = (x) => (x < 0 ? -1 : 1)
const round = (n) => Math.round(n * 1000) / 1000

// tangent from three points
const slope3 = (c, x2, y2) => {
  let h0 = c.x1 - c.x0
  let h1 = x2 - c.x1
  let s0 = (c.y1 - c.y0) / (h0 || (h1 < 0 && -0))
  let s1 = (y2 - c.y1) / (h1 || (h0 < 0 && -0))
  let p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
}
// one-sided tangent, for the ends
const slope2 = (c, t) => {
  let h = c.x1 - c.x0
  return h ? ((3 * (c.y1 - c.y0)) / h - t) / 2 : t
}

class MonotoneX {
  constructor() {
    this.d = ''
    this.line = NaN
  }
  areaStart() {
    this.line = 0
  }
  areaEnd() {
    this.line = NaN
  }
  lineStart() {
    this.x0 = this.x1 = this.y0 = this.y1 = this.t0 = NaN
    this.pt = 0
  }
  lineEnd() {
    if (this.pt === 2) this.d += `L${round(this.x1)},${round(this.y1)}`
    if (this.pt === 3) this.bezier(this.t0, slope2(this, this.t0))
    if (this.line || (this.line !== 0 && this.pt === 1)) this.d += 'Z'
    this.line = 1 - this.line
  }
  // cubic segment from (x0,y0) to (x1,y1) with tangents t0, t1
  bezier(t0, t1) {
    let dx = (this.x1 - this.x0) / 3
    this.d += `C${round(this.x0 + dx)},${round(this.y0 + dx * t0)},${round(this.x1 - dx)},${round(this.y1 - dx * t1)},${round(this.x1)},${round(this.y1)}`
  }
  point(x, y) {
    let t1 = NaN
    if (x === this.x1 && y === this.y1) return // skip coincident points
    if (this.pt === 0) {
      this.pt = 1
      this.d += (this.line ? 'L' : 'M') + `${round(x)},${round(y)}`
    } else if (this.pt === 1) {
      this.pt = 2
    } else if (this.pt === 2) {
      this.pt = 3
      this.bezier(slope2(this, (t1 = slope3(this, x, y))), t1)
    } else {
      this.bezier(this.t0, (t1 = slope3(this, x, y)))
    }
    this.x0 = this.x1
    this.x1 = x
    this.y0 = this.y1
    this.y1 = y
    this.t0 = t1
  }
}

// like d3.area().x().y0().y1().curve(curveMonotoneX)
// pts: [{x, y0, y1}] in final coords — curves along y1, then back along the y0 baseline
export const monotoneArea = (pts) => {
  let c = new MonotoneX()
  c.areaStart()
  c.lineStart()
  pts.forEach((p) => c.point(p.x, p.y1))
  c.lineEnd()
  c.lineStart()
  for (let k = pts.length - 1; k >= 0; k -= 1) {
    c.point(pts[k].x, pts[k].y0)
  }
  c.lineEnd()
  c.areaEnd()
  return c.d
}
