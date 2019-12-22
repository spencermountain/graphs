let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const monthRow = months.map(str => {
  return `<td>${str}</td>`
})
const round = function(num) {
  return parseInt(num * 10, 10) / 10
}

const table = function(byMonth) {
  let timeRow = byMonth.map(a => {
    return `<td>${round(a[1]) + 'h'}</td>`
  })
  let diffRow = byMonth.map((a, i) => {
    let last
    if (byMonth[i - 1]) {
      last = byMonth[i - 1][1]
    } else {
      last = byMonth[byMonth.length - 1][1]
    }
    // let n = parseInt(a[1], 10)
    let delta = a[1] - last
    let diff = ''
    if (delta < 1 && delta > -1) {
      diff = round(delta * 60) + 'm'
    } else {
      diff = round(delta)
      // if (diff > 0) {
      // diff = '+' + diff
      // }
      diff += 'h'
    }
    // let diff = round(a[2] - a[1])
    // console.log(a)
    return `<td><span class="f2">${diff}</span></td>`
  })
  return `<div class="center w100p grey"> 
  <span class="underline">change:</span>
  <table class="w100p grey mt2 center" style="">
    <tr class="slate underline">${monthRow.join('')}</tr>
    <tr class="h3">${timeRow.join('')}</tr>
    <tr class="h3">${diffRow.join('')}</tr>
  <table>
  </div>
  `
}
module.exports = table
