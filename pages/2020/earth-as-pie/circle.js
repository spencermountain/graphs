// polar-svg helpers, ported from somehow-circle (svelte)
// viewbox is -50..50; degree 0 = 9 o'clock, increasing clockwise through the top
const rad = (deg) => (deg * Math.PI) / 180

// [x, y] point at a given angle + radius
export const polar = (deg, r) => [-r * Math.cos(rad(deg)), -r * Math.sin(rad(deg))]

// annular-sector path between two angles (from < to) — like d3-shape's arc()
export const arcPath = (from, to, r0, r1) => {
  const [x0, y0] = polar(from, r1)
  const [x1, y1] = polar(to, r1)
  const [x2, y2] = polar(to, r0)
  const [x3, y3] = polar(from, r0)
  const large = to - from > 180 ? 1 : 0
  return `M${x0},${y0}A${r1},${r1},0,${large},1,${x1},${y1}L${x2},${y2}A${r0},${r0},0,${large},0,${x3},${y3}Z`
}

// keep label text right-side-up; flip swaps the text-anchor side
export const labelAngle = (deg) => {
  if (deg > 90) return { angle: deg - 180, flip: true }
  if (deg < -90) return { angle: deg + 180, flip: true }
  return { angle: deg, flip: false }
}
