import spacetime from 'spacetime'

const range = function (points) {
  let max = {
    x: spacetime.now(),
    y: 0,
  }
  points.forEach(p => {
    if (p.y > max.y) {
      max.y = p.y
    }
    let x = spacetime(p.x)
    if (x.epoch > max.x.epoch) {
      max.x = x
    }
  })
  return max
}
export default range