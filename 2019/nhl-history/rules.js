const somehow = require('somehow');
// const somehow = require('/Users/spencer/mountain/somehow');
const today = new Date().toISOString()

let w = somehow({
  height: 100,
  width: 700,
});

// goalie masks - 1960 - 1969
w.text('goalie masks').font(12).at('oct 1 1960', '90%')
w.rect().color('sky').set([
  ['oct 1 1960', '0%'],
  ['oct 1 1969', '80%'],
])
// player helmets - 1972 - 1979
w.text('player helmets').font(12).at('oct 1 1972', '90%')
w.rect().color('green').set([
  ['oct 1 1972', '0%'],
  ['oct 1 1979', '80%'],
])
//nhl lockouts 94, 2004, 2012
w.text(['\'95', 'lockout']).font(12).at('oct 1 1993', '90%')
w.rect().color('orange').set([
  ['oct 1 1995', '0%'],
  ['jan 11 1996', '80%'],
])

w.text(['2004', 'lockout']).font(12).at('oct 1 2002', '90%')
w.rect().color('orange').set([
  ['oct 1 2004', '0%'],
  ['march 30 2005', '80%'],
])
w.text(['2012', 'lockout']).font(12).at('oct 1 2010', '90%')
w.rect().color('orange').set([
  ['oct 1 2012', '0%'],
  ['January 12, 2013', '80%'],
])

// w.fit()
// w.text('Changes:').at('0px', '100%')
w.x.fit('Jan 1 1942', today)
w.y.fit(-28, 28)
w.yAxis.remove()

let el = document.querySelector('#rules');
el.innerHTML = w.build()
