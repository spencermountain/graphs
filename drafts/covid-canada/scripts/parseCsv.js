const fs = require('fs')
let lines = fs
  .readFileSync('/Users/spencer/mountain/thensome/drafts/covid-canada/data/historical.csv')
  .toString()
  .split('\n')
  .map((str) => str.split(/[,\t]/))

let all = []
lines.forEach((a) => {
  all.push([(a[2] + ' ' + a[0]).trim(), Number(a[3])])
})
console.log(JSON.stringify(all, null, 2))
