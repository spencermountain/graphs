const sometime = require('sometime');
// const colors = require('spencer-color').list
const combos = require('spencer-color').combos
let colors = [...combos.ken, ...combos.dupont, ...combos.bloor]
const plusMinus = require('./plus-minus')
const compute = require('./compute');
const htm = require('htm');
const h = htm.bind(require('vhtml'));
const thisYear = new Date().getFullYear()


const makeList = function(parts) {
  let list = parts.map((s, i) => {
    let style = `border-bottom:3px solid ` + colors[i]
    return h`<div class="m1">
      ${i + 1}) <span style="${style}">${s.format('nice')}</span>
    </span>`
  })
  let html = `<div class="col grey left">${list.join('')}</div>`
  document.querySelector('#datelist').innerHTML = html
}

const makeCalendar = function(parts, year) {
  let cal = sometime.year.ByQuarter('nov 9th ' + year, {})
  parts.forEach((s, i) => {
    s = s.startOf('day')
    if (i === 0) {
      s = s.minus(1, 'minute')
    }
    let end = parts[i + 1] || s.endOf('year')
    // end = end.minus(1, 'day')
    cal.color(s.iso(), end.iso(), colors[i])
  })
  document.querySelector('#calendar').innerHTML = cal.build()
}

const doit = function() {
  let pieces = Number(document.querySelector('#plusMinus').value)
  let year = Number(document.querySelector('#yearNum').value)
  let parts = compute(pieces, year)
  makeList(parts)
  makeCalendar(parts, year)
}

document.querySelector('#controls').innerHTML = plusMinus.build(null, 4)
plusMinus.events(null, doit)

document.querySelector('#year').innerHTML = plusMinus.build('yearNum', thisYear)
plusMinus.events('yearNum', doit)

doit(4, thisYear)
