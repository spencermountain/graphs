import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
const dir = '/Users/spencer/Desktop/building-permits/'
import sh from 'shelljs'
import cleanup from './cleanup.js'

const getSums = function (json) {
  let sum = {
    rows: json.length,
    total: 0,
    condo: 0,
    middle: 0,
    res: 0,
  }
  json.forEach(o => {
    let units = parseInt(o.DWELLING_UNITS_CREATED, 10) || 0
    sum.total += units
    sum[o.type] += units
  })
  return sum
}

const parseDate = function (str) {
  if (!str) {
    return null
  }
  if (str.endsWith('0000')) {
    return `${str.substr(0, 4)}-${str.substr(4, 2)}-${str.substr(6, 2)}`
  }
  return str
}

let byYear = {}
const getApprovals = function (json) {
  json.forEach(o => {
    let date = parseDate(o.ISSUED_DATE)
    if (date) {

      let year = date.substr(0, 4)
      if (year.match(/\//)) {
        year = date.substr(6, 4)
      }
      byYear[year] = byYear[year] || 0
      byYear[year] += parseInt(o.DWELLING_UNITS_CREATED, 10) || 0
    }
  })
}

let all = []
sh.cd(dir)
sh.ls('*.csv').forEach(file => {
  let abs = path.join(dir, file)
  let year = file.replace(/clearedpermits/, '')
  year = Number(year.replace(/[\._]csv/g, '')) || year
  let str = fs.readFileSync(abs).toString()
  let json = Papa.parse(str, { header: true }).data

  getApprovals(json)
  json = cleanup(json)
  let counts = getSums(json)
  counts.year = year
  // console.log(file)
  all.push(counts)
})

all.forEach(o => {
  o.approvals = byYear[o.year]
})

console.log(JSON.stringify(all, null, 2))
// console.log(JSON.stringify(byYear, null, 2))