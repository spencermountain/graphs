const current = 231700
// const growth = 0.97
//
const pagesPerYear = function(growth = 0.97) {
  let guess = []
  let perYear = current
  let endYear = new Date().getFullYear() + 102
  for (let i = 2019; i < endYear; i += 1) {
    perYear = perYear * growth
    if (perYear < 2000) {
      perYear = 2000
    }
    perYear = parseInt(perYear, 10)
    guess.push([i + '-01-01', perYear])
  }
  return guess
}
module.exports = pagesPerYear
