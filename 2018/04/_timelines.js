// const somehow = require('somehow');
const somehow = require('/Users/spencer/mountain/somehow/src');
const today = new Date().toISOString()

const makeTimeline = function(year) {
  let w = somehow({
    height: 10,
    width: 700
  });

  let date = `Jan 1 ${year}`
  w.x.fit('Jan 1 1825', Date.now());
  w.y.fit(0, 3);
  w.yAxis.remove();
  let ticks = [
    {
      value: `jan 1 1825`,
      label: '1825'
    },
    {
      label: new Date().getFullYear(),
      value: today
    },
  ]
  if (year === 2019) {
    ticks = [ticks[0]]
    year = ''
  }
  w.xAxis.ticks(ticks);
  w.line().from(date, '-10px').to(date, '25px').color('brown');
  w.text(String(year)).center(date, '30px').dy(5).font(19).color('brown');
  return w
}

document.querySelector('#timeline1876').innerHTML = makeTimeline(1870).build();
document.querySelector('#timeline1990').innerHTML = makeTimeline(1900).build();
document.querySelector('#timeline1969').innerHTML = makeTimeline(1969).build();
document.querySelector('#timeline1976').innerHTML = makeTimeline(1976).build();
document.querySelector('#timeline2000').innerHTML = makeTimeline(2000).build();
document.querySelector('#timeline2013').innerHTML = makeTimeline(2013).build();
document.querySelector('#timeline2019').innerHTML = makeTimeline(2019).build();
