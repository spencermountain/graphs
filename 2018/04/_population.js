const somehow = require('/Users/spencer/mountain/somehow/src');
const data = require('./data/toronto-montreal');

let w = somehow({
  height: 200,
  width: 700
});

//titles
// w.text('Toronto').at('20px', '170px'); //.font(20); //.color('blue');
// w.text('and').at('45px', '150px').font(15).color('lightgrey');
// w.text('Montréal').at('40px', '130px').font(20).color('orange');

let toronto = data[0].years.map((a) => {
  a[0] = 'Jan 1 ' + String(a[0]);
  return a;
});
let tor = w.line().color('blue');
tor.set(toronto);

let montreal = data[1].years.map((a) => {
  a[0] = 'Jan 1 ' + String(a[0]);
  return a;
});
let mon = w.line().color('orange');
mon.set(montreal);
// w.yAxis.ticks([1000000, 2000000]);
w.yAxis.ticks([]);
w.text(['population']).color('lightgrey').font(10).from('-55px', '75%');

//referendums
w.line().from('May 20, 1980', '100px').to('May 20, 1980', '140px').width(1).color('grey');
w.text(['1st', 'referendum']).dy(-15).center('May 20, 1980', '100px').font(11).color('lightgrey');

w.line().from('October 30, 1995', '90px').to('October 30, 1995', '130px').width(1).color('grey');
w.text(['2nd', 'referendum']).dy(-15).center('October 30, 1995', '90px').font(11).color('lightgrey');
w.fit();
w.x.fit('Jan 1 1825', Date.now());

let el = document.querySelector('#stage');
el.innerHTML = w.build();
