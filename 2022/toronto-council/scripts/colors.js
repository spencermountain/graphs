const counts = require('../counts.js')
const colors = require('../lib/colors.js')

let byColor = {}
// let all = Object.values(colors)

let all = [
  '#6699cc',
  '#6accb2',
  '#e1e6b3',
  '#cc7066',
  '#F2C0BB',
  '#cc8a66',
  '#d8b3e6',
  '#7f9c6c',
  '#735873',
  '#e6d7b3',
  '#9c896c',
  '#2D85A8',
  '#303b50',
  '#914045',
  '#275291',
  '#cc6966',
  '#e6b3bc',
  '#D68881',
  '#AB5850',
  '#72697D',
  '#8BA3A2',
  '#978BA3',
  '#6D5685'
]

Object.keys(counts).forEach((k, i) => {
  byColor[k] = all[i % all.length]
})
console.log(byColor)