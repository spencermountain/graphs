// const somehow = require('somehow');
const somehow = require('/Users/spencer/mountain/somehow/src');

let w = somehow({
  height: 10,
  width: 700
});

w.x.fit('Jan 1 1825', Date.now());
w.y.fit(0, 3);
w.yAxis.remove();
w.xAxis.ticks([]);

w.line().from('Jan 1 1900', '-10px').to('Jan 1 1900', '25px').color('brown');
w.text('1900').center('Jan 1 1900', '30px').dy(5).font(19).color('brown');

let el = document.querySelector('#photo-timeline');
el.innerHTML = w.build();
