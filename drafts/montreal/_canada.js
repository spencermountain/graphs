// const somehow = require('somehow');
const somehow = require('/Users/spencer/mountain/somehow/src');
const data = require('./data/toronto-montreal');

let w = somehow({
  height: 80,
  width: 700
// aspect: 'widescreen',
});

let canada = data[2].years.map((a) => {
  a[0] = 'Jan 1 ' + String(a[0]);
  return a;
});
let can = w.area().color('lightgrey');
can.set(canada);
w.text('36m').color('lightgrey').font(12).center('102%', 36000000).dy(-10);

//ww1
w.line().from('Jul 28, 1914', '0px').to('Nov 11, 1918', '0px').color('red');
w.text('ww1').center('Jul 28, 1915', '-15px').dx(5).font(14).color('red');
//ww2
w.line().from('Sept 1 1939', '0px').to('Sept 2 1945', '0px').color('red');
w.text('ww2').center('Sept 1 1941', '-15px').dx(5).font(14).color('red');

w.text('Canada').color('lightgrey').center('62%', '50px');

//confederation
w.line().set([['July 1, 1867', '0px'], ['July 1, 1867', '15px']]).width(2);
w.xAxis.format('{year}');
w.xAxis.ticks(['July 1, 1867']);
w.xAxis.color('blue');

w.yAxis.remove();
w.fit();
let el = document.querySelector('#canada');
console.log(el);
el.innerHTML = w.build();
