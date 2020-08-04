//a very-tiny linear scale
const scaleLinear = function (obj) {
  let world = obj.world || []
  let minmax = obj.minmax || obj.minMax || []
  const calc = (num) => {
    let range = minmax[1] - minmax[0]
    let percent = (num - minmax[0]) / range
    let size = world[1] - world[0]
    return parseInt(size * percent, 10)
  }

  return calc
}
export default scaleLinear

// let scale = scaleLinear({
//   world: [0, 300],
//   minmax: [0, 100]
// })
