// const wordCount = 2661037011 //2,661,037,011 (2.6bn)
const growthPerYear = require('./growth-compute')
const thisYear = new Date().getFullYear()
const endyear = thisYear + 100
const wordsPerPage = 483

const findGrowth = function(growthRate) {
  return growthPerYear(growthRate).reduce((h, a) => {
    h[a[0].replace(/-.*/, '')] = a[1]
    return h;
  }, {});
}
const compute = function(wordsPerMinute, hoursPerDay, daysPerYear, growthRate) {
  let articleCount = 5793009 //5,793,009
  let wordsPerDay = wordsPerMinute * 60 * hoursPerDay
  let pagesPerDay = wordsPerDay / wordsPerPage
  let pagesPerYear = pagesPerDay * daysPerYear
  let growth = findGrowth(growthRate)
  //compute each year
  let points = []
  let pagesRead = 0
  for (let i = thisYear; i < endyear; i += 1) {
    articleCount += growth[i]
    pagesRead += pagesPerYear
    let percent = (pagesRead / articleCount) * 100
    percent = parseInt(percent, 10)
    if (percent > 100) {
      percent = 100
    }
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
