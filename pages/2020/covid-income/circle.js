// ported from somehow-circle (2020 build) — just the parts this post uses:
// filled arc/ring paths (d3-shape arc() equivalent) + rotated radial labels
const q = Math.PI / 2
const toRadian = (deg) => deg * (Math.PI / 180)
const rnd = (n) => Math.round(n * 1000) / 1000

// tiny offset-less scaleLinear, same as the original lib
const scaleLinear = ({ minmax, world }) => (num) =>
  ((num - minmax[0]) / (minmax[1] - minmax[0])) * (world[1] - world[0])

const point = (r, a) => [rnd(r * Math.cos(a)), rnd(r * Math.sin(a))]

// svg path for an annulus sector; angles like d3.arc (0 = 12 o'clock, clockwise)
const arcPath = function (r0, r1, startAngle, endAngle) {
  const a0 = startAngle - q
  const a1 = endAngle - q
  const da = Math.abs(a1 - a0)
  const sweep = a1 > a0 ? 1 : 0
  const [x0, y0] = point(r1, a0)
  if (r1 <= 0) {
    return 'M0,0Z'
  }
  // full ring — two outer halves, plus a reversed inner hole
  if (da > Math.PI * 2 - 1e-9) {
    let d = `M${x0},${y0}A${r1},${r1},0,1,${sweep},${-x0},${-y0}A${r1},${r1},0,1,${sweep},${x0},${y0}`
    if (r0 > 1e-9) {
      const [ix, iy] = point(r0, a0)
      d += `M${ix},${iy}A${r0},${r0},0,1,${1 - sweep},${-ix},${-iy}A${r0},${r0},0,1,${1 - sweep},${ix},${iy}`
    }
    return d + 'Z'
  }
  // partial sector
  const large = da >= Math.PI ? 1 : 0
  const [x1, y1] = point(r1, a1)
  let d = `M${x0},${y0}A${r1},${r1},0,${large},${sweep},${x1},${y1}`
  if (r0 > 1e-9) {
    const [ix1, iy1] = point(r0, a1)
    const [ix0, iy0] = point(r0, a0)
    d += `L${ix1},${iy1}A${r0},${r0},0,${large},${1 - sweep},${ix0},${iy0}`
  } else {
    d += 'L0,0'
  }
  return d + 'Z'
}

const drawArc = function (o, xScale, rScale, rotate) {
  const r = rScale(o.radius)
  const path = arcPath(rnd(r), rnd(r + rScale(o.width)), xScale(o.to) - q + rotate, xScale(o.from) - q + rotate)
  return { type: 'arc', color: o.color, path }
}

const drawLabel = function (o, xScale, rScale, rotate) {
  const a = xScale(o.angle) - q + rotate
  const r = rScale(o.radius)
  const x = rnd(r * Math.sin(a))
  const y = rnd(-r * Math.cos(a))
  let angle = o.angle
  let align = o.align || 'left'
  // don't go upside-down
  if (angle > 90) {
    angle -= 180
    align = align === 'left' ? 'right' : 'left'
  } else if (angle < -90) {
    angle += 180
    align = align === 'left' ? 'right' : 'left'
  }
  if (angle > 0) {
    angle -= o.rotate || 0
  } else {
    angle += o.rotate || 0
  }
  return {
    type: 'label',
    x,
    y,
    angle,
    align: align === 'left' ? 'start' : 'end',
    size: o.size || 1.5,
    text: o.text,
    color: o.color,
  }
}

// world = the old <Round/> props {from, to, rotate, margin}, angles in degrees
const layout = function (arcs, labels, world = {}) {
  const w = { from: 0, to: 360, rotate: 0, margin: 0, ...world }
  const xScale = scaleLinear({ minmax: [w.from, w.to], world: [-Math.PI, Math.PI] })
  const rotate = toRadian(w.rotate)
  // fit the biggest arc (plus margin) into svg-radius 50
  const maxR = Math.max(...arcs.map((o) => o.radius + o.width)) + w.margin
  const rScale = scaleLinear({ minmax: [0, maxR], world: [0, 50] })
  return [
    ...arcs.map((o) => drawArc(o, xScale, rScale, rotate)),
    ...labels.map((o) => drawLabel(o, xScale, rScale, rotate)),
  ]
}
export default layout
