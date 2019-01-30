// const wordCount = 2661037011 //2,661,037,011 (2.6bn)
const articleCount = 5793009 //5,793,009
const thisYear = new Date().getFullYear()
const endyear = thisYear + 100
const wordsPerPage = 483
const growthPerYear = require('./pagesPerYear')
let growth = growthPerYear().reduce((h, a) => {
  h[a[0].replace(/-.*/, '')] = a[1]
  return h;
}, {});

const compute = function(wordsPerMinute, hoursPerDay, daysPerYear) {
  let wordsPerDay = wordsPerMinute * 60 * hoursPerDay
  let pagesPerDay = wordsPerDay / wordsPerPage
  let pagesPerYear = pagesPerDay * daysPerYear
  //compute each year
  let points = []
  let pagesRead = 0
  let articles = articleCount
  for (let i = thisYear; i < endyear; i += 1) {
    articles += growth[i]
    pagesRead += pagesPerYear
    let percent = (pagesRead / articles) * 100
    percent = parseInt(percent, 10)
    points.push([`jan 1 ${i}`, percent])
    if (percent >= 100) {
      break
    }
  }
  return {
    pagesPerDay: Math.round(pagesPerDay),
    pagesPerYear: Math.round(pagesPerYear),
    points: points
  }
}

module.exports = compute
// compute(250, 8, 252, 200000)
