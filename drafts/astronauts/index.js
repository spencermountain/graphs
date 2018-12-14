// const somehow = require('somehow);
const spacetime = require('spacetime');
const somehow = require('/Users/spencer/mountain/somehow/src');
const missions = require('./data/missions');
const today = spacetime.now().format('iso');
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
    if (o.death) {
      line.set([
        [born.iso(), y],
        [o.death || today, y],
      ]);
      line.color('lightgrey');
    } else {
      let avg = born.add(EXPECT, 'years').iso();
      line.set([
        [born.iso(), y],
        [avg, y],
      ]);
      w.line().dotted(true).color('red').set([
        [today, y],
        [avg, y],
      ]);
    }
    //add label
    w.text(o.name).at(o.birth, y).dy(2);
  });

  //add date
  w.line().set([[missions[k].date, '10%'], [missions[k].date, '90%']]).width(1).color('orange').dotted();

  //add label
  w.text(k).at('-100px', '60%').color('lightgrey');
  //add today
  w.line().set([[today, '0%'], [today, '100%']]).width(1).color('lightgrey').dotted();

  w.y.fit(0, 4);
  // w.x.fit('Jan 1 1920', 'Dec 31 2018');
  w.x.fit('Jan 1 1925', 'Dec 31 2025');
  w.yAxis.remove();
  return w.build();
};



let el = document.querySelector('#stage');
el.innerHTML = Object.keys(missions).map(k => drawMission(k)).join(' ');

let legend = somehow({
  height: 200,
  aspect: 'widescreen',
});
legend.yAxis.remove();
legend.xAxis.remove();
legend.y.fit(0, 2);
legend.x.fit(-2, 10);
legend.text('birth').font(11).dy(10).at(1, 1);
legend.text('life expectency').font(11).dy(10).center(6, 1);
legend.text('(81 years)').font(12).dy(-20).center(6, 1);
legend.line().set([[1, 1], [6, 1]]).opacity(0.6);
legend.line().set([[6, 1], [7, 1]]).dotted(true).opacity(0.6).color('red');

let astronauts = Object.keys(missions).reduce((arr, k) => {
  arr = arr.concat(missions[k].people);
  return arr;
}, []);
let alive = astronauts.filter((o) => !o.death);
legend.text(`${alive.length} of ${astronauts.length} are alive`).set([[0, 1.7]]);
legend.text(`everyone is > 81 years old`).set([[4, 0.2]]);
document.querySelector('#legend').innerHTML = legend.build();
