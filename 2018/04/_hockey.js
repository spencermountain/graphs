const somehow = require('somehow')
let data = require('./data/winning-years')
let w = somehow({
  height: 110,
  width: 700
});

data.toronto.forEach((year) => {
  w.line().color('blue').set([[`jan 1 ${year}`, 3], [`sept 1 ${year}`, 3]])
})
data.montreal.forEach((year) => {
  w.line().color('red').set([[`jan 1 ${year}`, 2], [`sept 1 ${year}`, 2]])
})

w.line().color('grey').width(1).dotted().set([['oct 1 1967', '0%'], ['oct 1 1967', '70%']])
w.text('original six').font(10).color('grey').at('oct 1 1957', '80%')
w.text('NHL expansion').font(10).color('grey').at('oct 1 1967', '80%')

w.text('Stanley cup championships:').at('0%', '105%')
w.x.fit('Jan 1 1945', Date.now());
w.y.fit(4, 0);
w.yAxis.remove();

let el = document.querySelector('#hockey-timeline');
el.innerHTML = w.build();
