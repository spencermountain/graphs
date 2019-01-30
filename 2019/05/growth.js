const somehow = require('somehow');
const tick = require('./reading-tick')
const inputs = require('somehow-input')
const compute = require('./growth-compute')
let articleCount = 5793009 //5,793,009
let el = document.querySelector('#growth');

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

let tail = w.area().color('lightblue')
let annotation = w.annotation().size(18).nudge(-160, 60)

const drawTail = function(rate) {
  let projection = compute(rate)
  tail.set(projection)

  //add annotation for total article count
  let total = articleCount
  projection.forEach((a) => total += a[1])
  let num = (total / 1000000).toFixed(1)
  let text = [
    num + 'm articles'
  ]
  let end = projection[projection.length - 1]
  annotation.text(text).at(end[0], end[1])

  el.innerHTML = w.build()
}

//annotation for current size
let last = newArticles[newArticles.length - 1]
w.annotation('5.7m articles').size(18).at(last[0], last[1]).nudge(40, 60)

drawTail(0.9)

w.y.fit()
w.x.fit()

el.innerHTML = w.build()

let id = 'growthRate'
let slider = inputs.slider({
  label: 'growth rate',
  id: id,
  step: 0.01,
  min: 0.7,
  value: window.someState.growthRate,
  max: 0.99,
  cb: (val) => {
    window.someState.growthRate = Number(val)
    drawTail(val)
    tick()
  }
})
document.querySelector('#' + id).innerHTML = slider.build()
