// const somehow = require('somehow');
const somehow = require('/Users/spencer/mountain/somehow/src');
const data = require('./data/toronto-montreal');

let w = somehow({
  height: 20,
  width: 470
// aspect: 'widescreen',
});

let canada = data[2].years.map((a) => {
  a[0] = 'Jan 1 ' + String(a[0]);
  return a;
});
let can = w.line().color('lightgrey');
can.set(canada);
w.fit();
w.yAxis.remove();

let el = document.querySelector('#canada');
console.log(el);
el.innerHTML = w.build();
