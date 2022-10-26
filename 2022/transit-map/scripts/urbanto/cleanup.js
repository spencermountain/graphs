import results from './results.js'
let set = new Set()
console.log(results.length)
let all = results.filter(obj => {
  if (!obj["Number of Units"]) {
    return false
  }
  if (set.has(obj.url)) {
    return false
  }
  if (obj.Status === "Complete" || obj.Status === "Cancelled" || obj.Status === "On-Hold") {
    return false
  }
  set.add(obj.url)
  return true
})


const topk = function (arr) {
  let obj = {}
  arr.forEach(a => {
    obj[a] = obj[a] || 0
    obj[a] += 1
  })
  let res = Object.keys(obj).map(k => [k, obj[k]])
  return res.sort((a, b) => (a[1] > b[1] ? -1 : 0))
}
console.log(topk(all.map(o => o.Status)))
console.log(all.length)
