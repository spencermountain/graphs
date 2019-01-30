const somehow = require('/Users/spencer/mountain/somehow');
const pagesPerYear = require('./growth-compute')
let articleCount = 5793009 //5,793,009

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
w.area().color('blue').set(newArticles)

let projection = pagesPerYear(0.97)
w.area().color('lightblue').set(projection)

//annotation for current size
let last = newArticles[newArticles.length - 1]
w.annotation('5.7m articles').size(18).at(last[0], last[1]).nudge(40, 60)

//add annotation for total article count
let total = articleCount
projection.forEach((a) => total += a[1])
let num = (total / 1000000).toFixed(1)
let text = [
  num + 'm articles'
]
last = projection[projection.length - 1]
w.annotation(text).size(18).at(last[0], last[1]).nudge(-160, 60)

w.y.fit()
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
