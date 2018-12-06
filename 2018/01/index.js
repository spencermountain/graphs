let el = document.querySelector('body');
// el.innerHTML = '<h2>one.</h2>'

// const somehow = require('./assets/somehow');
const somehow = require('/Users/spencer/mountain/somehow/src/index.js');
const cities = require('./data/cities');
console.log(cities.Boston);
const city = 'Boston';

let w = somehow({
  height: 200,
  aspect: 'widescreen',
  el: el
});

const drawLine = function(start, end, index, label) {
  let l = w.line();
  l.set(`${start}, ${index}
${end}, ${index}`);
  let txt = w.text(label);
  txt.set(`${start}, ${index}`);
};
let txt = w.text(city);
txt.set('-25%, 50%');
// txt.set(`${start}, ${index}`);
// drawLine('jan 12 2018', 'june 5 2018', 3, 'cool');

// w.fit(0, 10);
// w.x.fit('Jan 1 2018', 'Dec 31 2018');
w.xAxis.ticks(12);
w.yAxis.remove();
w.build();
