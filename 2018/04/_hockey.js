const somehow = require('somehow')
const data = require('./data/hockey-data')
let w = somehow({
  height: 200,
  width: 700
});

Object.keys(data).forEach((team) => {
  data[team].forEach((a) => {
    a[0] = 'March 30 ' + a[0]
    return a
  })
})

w.line().color('blue').set(data.toronto)
w.line().color('red').set(data.montreal)

w.x.fit('Jan 1 1965', Date.now());
w.y.fit(10, 0);
w.yAxis.remove();

let el = document.querySelector('#hockey-timeline');
el.innerHTML = w.build();
