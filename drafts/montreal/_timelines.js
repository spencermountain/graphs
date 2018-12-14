// const somehow = require('somehow');
const somehow = require('/Users/spencer/mountain/somehow/src');

let w = somehow({
  height: 20,
  width: 700
});

w.x.fit('Jan 1 1825', Date.now());
w.y.fit(0, 3);
w.yAxis.remove();

w.line().from('Jan 1919', '-5px').to('Jan 1919', '30px').color('grey');
w.text('1918').center('Jan 1919', '30px').dy(5).font(19).color('grey');

let el = document.querySelector('#photo-timeline');
el.innerHTML = w.build();
