const somehow = require('/Users/spencer/mountain/somehow');
// const somehow = require('somehow');
const pagesPerYear = require('./pagesPerYear')
let w = somehow({
  el: '#growth',
  height: 300,
  width: 700,
});

const newArticles = [
  ['2002-01-01', 19700],
  ['2003-01-01', 76800],
  ['2004-01-01', 92300],
  ['2005-01-01', 249700],
  ['2006-01-01', 456500],
  ['2007-01-01', 665000],
  ['2008-01-01', 593000],
  ['2009-01-01', 526000],
  ['2010-01-01', 465000],
  ['2011-01-01', 374000],
  ['2012-01-01', 317000],
  ['2013-01-01', 298000],
  ['2014-01-01', 280000],
  ['2015-01-01', 269000],
  ['2016-01-01', 363000],
  ['2017-01-01', 276200],
  ['2018-01-01', 220700],
  ['2019-01-01', 231700]
]
w.line().color('blue').set(newArticles)

let years = pagesPerYear(0.97)
w.line().width(3).dotted(7).color('blue').set(years)

w.y.fit()
// w.x.fit('jan 1 2002', `jan 1 ${new Date().getFullYear() + 100}`)
w.x.fit()

let el = document.querySelector('#growth');
el.innerHTML = w.build()

// let id = 'growthRate'
// let growthRate = w.slider({
//   id: id,
//   min: 1,
//   value: 1.05,
//   max: 1.1,
// // cb: () => {
// //   console.log('hi')
// // }
// })
// document.querySelector('#' + id).innerHTML = growthRate.build()
