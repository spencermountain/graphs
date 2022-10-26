import data from './data.js'

// cluster by unit size
let obj = {}
data.forEach(o => {
  let ward = o.ward
  obj[ward] = obj[ward] || { total: 0, pending: 0, issued: 0 }
  obj[ward].total += o.units
  if (o.issued) {
    obj[ward].issued += o.units
  } else {
    obj[ward].pending += o.units
  }
})
let all = Object.entries(obj).sort((a, b) => {
  if (a[1] > b[1]) {
    return -1
  } else if (a[1] < b[1]) {
    return 1
  }
  return 0
})
all = all.map(a => {
  return Object.assign(a[1], { name: a[0] })
})
all = all.sort((a, b) => {
  if (a.total > b.total) {
    return -1
  } else if (a.total < b.total) {
    return 1
  }
  return 0
})
console.log(all)
