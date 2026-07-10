// aqua colour ramp — hand-rolled port of the original's chroma.scale(aquas)
// (chroma.scale interpolates linearly in RGB space across equidistant stops)
let aquas = ['#ffffff', '#d1edce', '#afeab5', '#85d69c', '#60c28e', '#41ae87', '#269a85', '#108685', '#005f72', '#013742', '#011a42']

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const rgbs = aquas.map(toRgb)

// rate 0→1 becomes a hex colour, quantized to 1% steps like the original
const toHex = function (val) {
  let t = parseInt(val * 100, 10) / 100
  t = Math.min(Math.max(t, 0), 1)
  let pos = t * (rgbs.length - 1)
  let i = Math.min(Math.floor(pos), rgbs.length - 2)
  let f = pos - i
  let a = rgbs[i]
  let b = rgbs[i + 1]
  let rgb = a.map((ch, k) => Math.round(ch + (b[k] - ch) * f))
  return '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('')
}
export default toHex
