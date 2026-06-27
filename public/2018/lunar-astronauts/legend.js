const somehow = require('somehow');
const missions = require('./data/missions');

let legend = somehow({
  height: 100,
  width: 500,
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

// let astronauts = Object.keys(missions).reduce((arr, k) => {
//   arr = arr.concat(missions[k].people);
//   return arr;
// }, []);
// let alive = astronauts.filter((o) => !o.death);
// legend.text(`${alive.length} of ${astronauts.length} are alive`).set([[0, 1.7]]);
// legend.text(`all are > 81 years old`).set([[4, 0.2]]);
document.querySelector('#legend').innerHTML = legend.build();
