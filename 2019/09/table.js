let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const monthRow = months.map(str => {
  return `<td>${str}</td>`
})
const round = function(num) {
  return parseInt(num * 10, 10) / 10
}

const table = function(byMonth) {
  let timeRow = byMonth.map(a => {
    return `<td>${parseInt(a[1], 10) + 'h'}</td>`
  })
  let diffRow = byMonth.map((a, i) => {
    let last
    if (byMonth[i - 1]) {
      last = byMonth[i - 1][1]
    } else {
      last = byMonth[byMonth.length - 1][1]
    }
    let n = parseInt(a[1], 10)
    let diff = round(n - last)
    if (diff > 0) {
      diff = '+' + diff
    }
    return `<td><span class="f2">${diff}</span></td>`
  })
  return `<div class="center w100p grey"> 
  <span class="underline">change (hours):</span>
  <table class="w100p grey mt2 center" style="">
    <tr class="slate underline">${monthRow.join('')}</tr>
    <tr class="h3">${diffRow.join('')}</tr>
  <table>
  </div>
  `
}
module.exports = table
