const spacetime = require('spacetime')

const compute = function(num, year) {
  let parts = []
  let start = spacetime.now().year(year).startOf('year')
  let end = spacetime.now().year(year).endOf('year')
  let diff = end.epoch - start.epoch
  let part = diff / num
  for (let i = 0; i < num; i += 1) {
    let epoch = start.epoch + (part * i)
    parts.push(spacetime(epoch))
  }
  return parts
}
module.exports = compute
