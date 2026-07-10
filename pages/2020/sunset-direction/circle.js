// geometry ported from somehow-circle (Round/Arc/Line/Tick), specialized to
// this chart's config: rotate=-90°, from=0 to=360, margin=10, viewBox ±50
const Q = Math.PI / 2 // somehow-circle's quarter-turn offset
const ROTATE = -Q // Round rotate="-90"
const MAX_R = 70 // outermost element: week arcs at radius 52 + width 8 + margin 10
const toRad = (deg) => (deg * Math.PI) / 180
const rScale = (r) => (r / MAX_R) * 50 // world radius → svg units
const theta = (deg) => toRad(deg) - Q + ROTATE // azimuth° → screen angle, clockwise from 12 o'clock
const pt = (a, r) => [r * Math.sin(a), -r * Math.cos(a)]
const f = (n) => +n.toFixed(2)

// annular sector, like d3-shape's arc() in the original drawArcs.js
export const arcPath = function ({ from, to, radius, width }) {
  let a0 = theta(from)
  let a1 = theta(to)
  if (a1 < a0) {
    ;[a0, a1] = [a1, a0]
  }
  let r0 = rScale(radius)
  let r1 = r0 + rScale(width)
  let large = a1 - a0 > Math.PI ? 1 : 0
  let [x0, y0] = pt(a0, r1)
  let [x1, y1] = pt(a1, r1)
  let [x2, y2] = pt(a1, r0)
  let [x3, y3] = pt(a0, r0)
  return `M${f(x0)},${f(y0)} A${f(r1)},${f(r1)} 0 ${large} 1 ${f(x1)},${f(y1)} L${f(x2)},${f(y2)} A${f(r0)},${f(r0)} 0 ${large} 0 ${f(x3)},${f(y3)} Z`
}

// radial line from radius → radius+length (drawLines.js)
export const linePath = function ({ angle, radius, length }) {
  let a = theta(angle)
  let [x0, y0] = pt(a, rScale(radius))
  let [x1, y1] = pt(a, rScale(radius + length))
  return `M${f(x0)},${f(y0)} L${f(x1)},${f(y1)}`
}

// text tick: position, rotation + anchor (drawTicks.js)
export const tick = function ({ angle, radius, rotate = 90, align }) {
  align = align || (angle < 0 ? 'left' : 'right')
  let [x, y] = pt(theta(angle), rScale(radius))
  let a = angle
  // don't go upside-down
  if (a > 90) {
    a -= 180
    align = align === 'left' ? 'right' : 'left'
  } else if (a < -90) {
    a += 180
    align = align === 'left' ? 'right' : 'left'
  }
  a = a > 0 ? a - rotate : a + rotate
  return { x: f(x), y: f(y), angle: f(a), anchor: align === 'left' ? 'start' : 'end' }
}
