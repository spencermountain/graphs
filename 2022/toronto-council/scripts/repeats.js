const data = require('../data.js')
let repeats = {}
let years = Object.keys(data)
years.forEach((k, i) => {
  console.log(k)
  let names = data[String(k)]
  names.forEach(str => {
    if (years[i - 1] && data[years[i - 1]].find(s => s === str)) {
      repeats[str] = repeats[str] || 1
      repeats[str] += 1
    }
  })
})

let arr = Object.entries(repeats)
arr = arr.sort((a, b) => {
  if (a[1] > b[1]) {
    return -1
  } else if (a[1] < b[1]) {
    return 1
  }
  return 0
})
let out = {}
arr.forEach(a => {
  out[a[0]] = a[1]
})
console.log(out)
