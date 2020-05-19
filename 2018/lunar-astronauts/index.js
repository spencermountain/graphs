const somehow = require('somehow');
// const somehow = require('/Users/spencer/mountain/somehow/src');
const spacetime = require('spacetime');
const missions = require('./data/missions');
const today = spacetime.now().format('iso');
require('./legend')
const EXPECT = 81;

const drawMission = function(k) {
  let w = somehow({
    height: 200,
    aspect: 'widescreen',
  });

  missions[k].people.forEach((o, i) => {
    let y = i + 1;
    let line = w.line();
    let born = spacetime(o.birth);

    //:(
    if (o.death) {
      line.set([
        [born.iso(), y],
        [o.death || today, y],
      ]);
      line.color('lightgrey');
    } else { //:)
      let avg = born.add(EXPECT, 'years').iso();
      line.set([
        [born.iso(), y],
        [avg, y],
      ]);
      w.line().dotted(true).color('red').set([
        [today, y],
        [avg, y],
      ]);
      let age = born.diff(spacetime.now(), 'years');
      w.text(age + 'yr').font(10).dx(10).dy(-8).color('lightgrey').after(today, y);
    }
    //add label
    w.text(o.name).at(o.birth, y).dy(2);
  });

  //add date
  w.line().set([[missions[k].date, '20%'], [missions[k].date, '80%']]).width(1).color('orange').dotted();

  //add label
  w.text(k).at('-100px', '60%').color('lightgrey');
  //add today
  w.line().set([[today, '10%'], [today, '90%']]).width(1).color('lightgrey').dotted();

  w.y.fit(0, 4);
  w.x.fit('Jan 1 1925', 'Dec 31 2025');
  w.yAxis.remove();
  w.xAxis.ticks([
    {
      label: '1925',
      value: 'jan 1 1925'
    },
    {
      label: '1969',
      value: 'jan 1 1969'
    },
    {
      value: spacetime.now().iso(),
      label: 'today'
    }
  ])
  return `<div class="m2">${w.build()}</div>`
};



let el = document.querySelector('#stage');
el.innerHTML = Object.keys(missions).map(k => drawMission(k)).join(' ');
