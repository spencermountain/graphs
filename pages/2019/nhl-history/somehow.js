// tiny port of the 'somehow' v0.0.10 chart lib (only the parts these charts use)
// builds a flat list of svg primitives, rendered by Chart.vue
import colors from '~/assets/colors.js'

const AXIS_COLOR = '#d7d5d2' // colors.lighter

// --- date parsing (utc, deterministic for ssr) ---
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
const parseDate = (str) => {
  const [mon, day, year] = String(str).replace(/,/g, '').trim().split(/\s+/)
  return Date.UTC(Number(year), MONTHS[mon.toLowerCase().slice(0, 3)], Number(day))
}

// '5px' | '50%' | number | date-string  ->  {type, value}
const parse = (input) => {
  if (typeof input === 'number') return { type: 'number', value: input }
  const str = String(input)
  if (/[0-9]px$/.test(str)) return { type: 'pixel', value: Number(str.replace(/px$/, '')) }
  if (/[0-9]%$/.test(str)) return { type: 'percent', value: Number(str.replace(/%$/, '')) }
  const num = Number(str)
  if (!isNaN(num)) return { type: 'number', value: num }
  return { type: 'date', value: parseDate(str) }
}

const minmax = (arr) => {
  let min = null
  let max = null
  arr.forEach((n) => {
    if (min === null || n < min) min = n
    if (max === null || n > max) max = n
  })
  return { min, max }
}

// --- monotone-x cubic curve, ported from d3-shape ---
const fmt = (n) => Math.round(n * 100) / 100
const sign = (x) => (x < 0 ? -1 : 1)

class PathCtx {
  constructor() {
    this.d = ''
  }
  moveTo(x, y) {
    this.d += `M${fmt(x)},${fmt(y)}`
  }
  lineTo(x, y) {
    this.d += `L${fmt(x)},${fmt(y)}`
  }
  bezierCurveTo(a, b, c, d, x, y) {
    this.d += `C${fmt(a)},${fmt(b)},${fmt(c)},${fmt(d)},${fmt(x)},${fmt(y)}`
  }
  closePath() {
    this.d += 'Z'
  }
}

class MonotoneX {
  constructor(ctx) {
    this._context = ctx
    this._line = 0
  }
  lineStart() {
    this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN
    this._point = 0
  }
  lineEnd() {
    switch (this._point) {
      case 2:
        this._context.lineTo(this._x1, this._y1)
        break
      case 3:
        this._pt(this._t0, this._slope2(this._t0))
        break
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath()
    this._line = 1 - this._line
  }
  _slope3(x2, y2) {
    const h0 = this._x1 - this._x0
    const h1 = x2 - this._x1
    const s0 = (this._y1 - this._y0) / (h0 || (h1 < 0 && -0))
    const s1 = (y2 - this._y1) / (h1 || (h0 < 0 && -0))
    const p = (s0 * h1 + s1 * h0) / (h0 + h1)
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  _slope2(t) {
    const h = this._x1 - this._x0
    return h ? (3 * (this._y1 - this._y0) / h - t) / 2 : t
  }
  _pt(t0, t1) {
    const dx = (this._x1 - this._x0) / 3
    this._context.bezierCurveTo(this._x0 + dx, this._y0 + dx * t0, this._x1 - dx, this._y1 - dx * t1, this._x1, this._y1)
  }
  point(x, y) {
    let t1 = NaN
    x = +x
    y = +y
    if (x === this._x1 && y === this._y1) return
    switch (this._point) {
      case 0:
        this._point = 1
        this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y)
        break
      case 1:
        this._point = 2
        break
      case 2:
        this._point = 3
        this._pt(this._slope2((t1 = this._slope3(x, y))), t1)
        break
      default:
        this._pt(this._t0, (t1 = this._slope3(x, y)))
        break
    }
    this._x0 = this._x1
    this._x1 = x
    this._y0 = this._y1
    this._y1 = y
    this._t0 = t1
  }
}

const monotoneLine = (points) => {
  const ctx = new PathCtx()
  const m = new MonotoneX(ctx)
  m.lineStart()
  points.forEach((p) => m.point(p[0], p[1]))
  m.lineEnd()
  return ctx.d
}

// area between a top line and bottom line (drawn back-to-front), like d3.area
const monotoneArea = (top, bottom) => {
  const ctx = new PathCtx()
  const m = new MonotoneX(ctx)
  m.lineStart()
  top.forEach((p) => m.point(p[0], p[1]))
  m.lineEnd()
  m.lineStart()
  ;[...bottom].reverse().forEach((p) => m.point(p[0], p[1]))
  m.lineEnd()
  return ctx.d
}

// --- linear scale (y is flipped) ---
class Scale {
  constructor(world, isY) {
    this.world = world
    this.isY = isY
    this.min = 0
    this.max = 1
    this._format = 'number'
  }
  get length() {
    return this.isY ? this.world.height : this.world.width
  }
  scale(num) {
    const [a, b] = this.isY ? [this.max, this.min] : [this.min, this.max]
    return Math.trunc(this.length * ((num - a) / (b - a)))
  }
  byPercent(n) {
    return (n / 100) * (this.max - this.min) + this.min
  }
  place(obj) {
    if (obj.type === 'pixel') return this.isY ? this.length - obj.value : obj.value
    if (obj.type === 'percent') return this.scale(this.byPercent(obj.value))
    return this.scale(obj.value)
  }
  _parse(v) {
    const o = parse(v)
    if (o.type === 'date') this._format = 'date'
    return o.value
  }
  fit(a, b) {
    if (a !== undefined && a !== null) this.min = this._parse(a)
    if (b !== undefined && b !== null) this.max = this._parse(b)
    return this
  }
}

// --- axis ticks ---
const prettyNum = (num) => {
  if (num >= 1000000) return Math.trunc(num / 100000) / 10 + 'm'
  if (num >= 1000) return Math.trunc(num / 100) / 10 + 'k'
  return Number(num.toFixed(3)).toLocaleString()
}
const ticks = (scale, count = 6) => {
  const n = count - 1
  const out = []
  for (let i = 0; i <= n; i += 1) {
    const num = (i / n) * (scale.max - scale.min) + scale.min
    out.push({
      pos: scale.scale(num),
      label: scale._format === 'date' ? String(new Date(num).getUTCFullYear()) : prettyNum(num),
    })
  }
  return out
}

// --- shapes ---
class Shape {
  constructor(world, attrs = {}) {
    this.world = world
    this.attrs = Object.assign({ 'shape-rendering': 'optimizeQuality' }, attrs)
    this.data = []
  }
  set(arr) {
    this.data = arr.map((a) => this.world.parsePoint(a))
    return this
  }
  points() {
    const { x, y } = this.world
    return this.data.map((o) => {
      const arr = [x.place(o.x), y.place(o.y)]
      if (o.y2 !== undefined) arr.push(y.place(o.y2))
      return arr
    })
  }
  extent() {
    const xs = []
    const ys = []
    this.data.forEach((o) => {
      if (o.x.type !== 'pixel') xs.push(o.x.value)
      if (o.y.type !== 'pixel') ys.push(o.y.value)
      if (o.y2 && o.y2.type !== 'pixel') ys.push(o.y2.value)
    })
    return { x: minmax(xs), y: minmax(ys) }
  }
}

class Line extends Shape {
  constructor(world) {
    super(world, { fill: 'none', stroke: colors.blue, 'stroke-width': 4, 'stroke-linecap': 'round' })
  }
  color(name) {
    this.attrs.stroke = colors[name] || name
    return this
  }
  width(n) {
    this.attrs['stroke-width'] = n
    return this
  }
  build() {
    return [{ type: 'path', attrs: { ...this.attrs, d: monotoneLine(this.points()) } }]
  }
}

class Rect extends Shape {
  constructor(world) {
    super(world, { fill: colors.green, stroke: colors.green, 'fill-opacity': 0.25, 'stroke-width': 1 })
  }
  color(name) {
    const c = colors[name] || name
    this.attrs.fill = c
    this.attrs.stroke = c
    return this
  }
  build() {
    const [a, b] = this.points()
    const width = Math.abs(b[0] - a[0])
    const height = Math.abs(b[1] - a[1])
    return [{ type: 'rect', attrs: { ...this.attrs, x: a[0], y: a[1] - height, width, height, rx: 3 } }]
  }
}

// filled band mirrored around zero: y -> ±y/2
class MidArea extends Shape {
  constructor(world) {
    super(world, { fill: colors.green, stroke: colors.green, 'fill-opacity': 0.25, 'stroke-width': 2 })
  }
  color(name) {
    const c = colors[name] || name
    this.attrs.fill = c
    this.attrs.stroke = c
    return this
  }
  set(arr) {
    super.set(arr)
    this.data.forEach((o) => {
      o.y.value /= 2
      o.y2 = { ...o.y, value: o.y.value * -1 }
    })
    return this
  }
  build() {
    const pts = this.points()
    const top = pts.map((p) => [p[0], p[1]])
    const bottom = pts.map((p) => [p[0], p[2]])
    return [
      { type: 'path', attrs: { ...this.attrs, d: monotoneLine(top), fill: 'none' } },
      { type: 'path', attrs: { ...this.attrs, d: monotoneArea(top, bottom), stroke: 'none' } },
      { type: 'path', attrs: { ...this.attrs, d: monotoneLine(bottom), fill: 'none' } },
    ]
  }
}

class Text extends Shape {
  constructor(world, lines) {
    super(world, { fill: 'grey' }) // css grey, like the original default
    this.lines = typeof lines === 'string' ? [lines] : lines || []
    this.data = [world.parsePoint(['50%', '50%'])]
    this._dodge = { x: 0, y: 4 }
    this.fontSize = null
  }
  at(x, y) {
    return this.set([[x, y]])
  }
  color(name) {
    this.attrs.fill = colors[name] || name
    return this
  }
  dx(n) {
    this._dodge.x = n
    return this
  }
  font(n) {
    this.fontSize = n
    return this
  }
  estimate() {
    // rough text metrics, same math as the original
    let height = (this.fontSize ? this.fontSize * 1.5 : 24) * this.lines.length
    const width = Math.max(...this.lines.map((s) => s.length * 8), 0)
    return { height, width }
  }
  position() {
    const p = this.points()[0]
    const { height } = this.estimate()
    return { x: p[0] + 2 + this._dodge.x, y: p[1] + this._dodge.y - height }
  }
  extent() {
    // original's text-extent was inert during fit() — keep texts out of it
    return { x: { min: null, max: null }, y: { min: null, max: null } }
  }
  build() {
    const { x, y } = this.position()
    return [{ type: 'text', x, y, fill: this.attrs.fill, anchor: this.attrs['text-anchor'] || null, fontSize: this.fontSize, lines: this.lines }]
  }
}

// labelled callout: text block + underline + connector line to the data point
class Annotation extends Text {
  constructor(world, lines) {
    super(world, lines)
    this._nudge = { x: 0, y: 0 }
  }
  on(x, y) {
    return this.at(x, y)
  }
  nudge(x, y) {
    this._nudge = { x, y }
    return this
  }
  build() {
    const est = this.estimate()
    const pos = this.position()
    const p = this.points()[0]
    let lx = p[0] + this._nudge.x
    const ly = p[1] - this._nudge.y + 4
    if (this._nudge.x < 0) lx += est.width // attach connector to the right side of the text
    return [
      {
        type: 'text',
        x: pos.x + this._nudge.x,
        y: pos.y - this._nudge.y,
        fill: 'grey',
        anchor: 'start',
        fontSize: this.fontSize,
        lines: this.lines,
        underline: { w: est.width, h: est.height },
      },
      { type: 'line', attrs: { x1: lx, y1: ly, x2: p[0], y2: p[1], stroke: colors.grey, 'stroke-width': 2 } },
    ]
  }
}

// --- world ---
class World {
  constructor({ width = 600, height = 400 } = {}) {
    this.width = width
    this.height = height
    this.shapes = []
    this.x = new Scale(this, false)
    this.y = new Scale(this, true)
    this._showX = true
    this._showY = true
    this.xAxis = { remove: () => (this._showX = false) }
    this.yAxis = { remove: () => (this._showY = false) }
  }
  parsePoint(a) {
    const x = parse(a[0])
    if (x.type === 'date') this.x._format = 'date'
    const y = parse(a[1])
    if (y.type === 'date') this.y._format = 'date'
    const o = { x, y }
    if (a[2] !== undefined) o.y2 = parse(a[2])
    return o
  }
  _add(shape) {
    this.shapes.push(shape)
    return shape
  }
  line() {
    return this._add(new Line(this))
  }
  rect() {
    return this._add(new Rect(this))
  }
  midArea() {
    return this._add(new MidArea(this))
  }
  text(lines) {
    return this._add(new Text(this, lines))
  }
  annotation(lines) {
    return this._add(new Annotation(this, lines))
  }
  _fitScale(scale, key) {
    const vals = []
    this.shapes.forEach((s) => {
      const e = s.extent()[key]
      if (e.min !== null) vals.push(e.min, e.max)
    })
    const e = minmax(vals)
    const min = e.min || 0
    scale.min = min > 0 && scale._format !== 'date' ? 0 : min
    scale.max = e.max || 0
  }
  fit() {
    this._fitScale(this.x, 'x')
    this._fitScale(this.y, 'y')
    return this
  }
  build() {
    const els = []
    if (this._showX) {
      ticks(this.x).forEach((t) => els.push({ type: 'tick', x: t.pos, y: this.height + 15, anchor: 'middle', label: t.label }))
      els.push({ type: 'line', attrs: { x1: 0, y1: this.height, x2: this.width, y2: this.height, stroke: AXIS_COLOR, 'stroke-width': 1 } })
    }
    if (this._showY) {
      ticks(this.y).forEach((t) => els.push({ type: 'tick', x: -6, y: t.pos, anchor: 'end', label: t.label }))
      els.push({ type: 'line', attrs: { x1: 0, y1: 0, x2: 0, y2: this.height, stroke: AXIS_COLOR, 'stroke-width': 1 } })
    }
    this.shapes.forEach((s) => els.push(...s.build()))
    return { width: this.width, height: this.height, els }
  }
}

export default (obj) => new World(obj)
