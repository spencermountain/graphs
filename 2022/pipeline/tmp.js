import data from './data.js'
let already = new Set()

let arr = data.filter(o => {
  if (already.has(o.address)) {
    return false
  }
  already.add(o.address)
  return true
})
console.log(JSON.stringify(arr, null, 2))
