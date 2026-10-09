//a very-tiny version of d3-scale's scaleLinear
const scaleLinear = function (obj, num) {
  const world = obj.world || []
  const minmax = obj.minmax || []
  const range = minmax[1] - minmax[0]
  const percent = (num - minmax[0]) / range
  const size = world[1] - world[0]
  return parseInt(size * percent, 10)
}
export default scaleLinear
