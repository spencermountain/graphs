import data from './counts.js'
let sum = data.reduce((h, a) => {
  h += a.total
  return h
}, 0)
console.log(sum)

const percent = (part, total) => {
  let num = (part / total) * 100
  num = Math.round(num * 10) / 10
  return num
}

let total = 0
let below = 0
let above = 0
data.forEach((o, i) => {
  let p = o.total//percent(o.total, sum)
  total += p
  if (i < 7) {
    above += p
  } else {
    below += p
  }
  console.log(p + '%', o.name)
})
console.log(above, below)
console.log(total)
