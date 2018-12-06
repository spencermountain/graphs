let el = document.querySelector('#stage');

// const somehow = require('./assets/somehow');
const spacetime = require('spacetime');
const colors = require('spencer-color');
const somehow = require('/Users/spencer/mountain/somehow/src/index.js');
const cities = require('./data/cities');

const leagues = {
  mls: {
    color: colors.brown,
    start: 'March 3 2018',
    end: 'October 28 2018',
  },
  nfl: {
    color: colors.orange,
    start: 'September 6 2018',
    end: 'February 3 2019',
  },
  mlb: {
    color: colors.blue,
    start: 'March 29 2018',
    end: 'October 1 2018',
  },
  nhl: {
    color: colors.red,
    start: 'October 3 2018',
    end: 'April 6 2019',
  },
  nba: {
    color: colors.green,
    start: 'October 16 2018',
    end: 'April 10 2019',
  },
};


const drawTwoLines = function(w, start, end, index, label, color) {
  let yearEnd = spacetime('Dec 31 2018');
  //should we draw two lines?
  let yearStart = spacetime('Jan 1 2018').format('iso');
  let l1 = w.line();
  l1.color(color);
  let newEnd = spacetime(end).minus(1, 'year').format('iso');
  l1.set(`${yearStart}, ${index}
    ${newEnd}, ${index}`);

  let l2 = w.line();
  l2.color(color);
  l2.set(`${start}, ${index}
${yearEnd.format('iso')}, ${index}`);
};


const drawLine = function(w, start, end, index, label, color) {
  let l = w.line();
  l.color(color);
  l.set(`${start}, ${index}
${end}, ${index}`);

// let txt = w.text(label);
// txt.fontSize(10);
// txt.set(`${start}, ${index}`);
};

const drawCity = function(name, id) {
  let w = somehow({
    height: 200,
    aspect: 'widescreen',
    el: document.querySelector(id)
  });
  let city = cities[name];
  let txt = w.text(name);
  txt.set('-25%, 50%');
  let i = 1;
  Object.keys(leagues).forEach((k) => {
    let league = leagues[k];
    city[k] = city[k] || [];
    city[k].forEach((team) => {
      let y = i * 10 + 'px';
      if (k === 'nhl' || k === 'nba' || k === 'nfl') {
        drawTwoLines(w, league.start, league.end, y, team, league.color);
      } else {
        drawLine(w, league.start, league.end, y, team, league.color);
      }

      team = team.replace(name, '').trim();
      team = w.text(team);
      team.fontSize(10);
      team.color('lightgrey');
      team.set(`110%, ${y}`);
      let leg = w.line();
      leg.width(2);
      leg.color(league.color);
      y = ((i * 10) + 6) + 'px';
      leg.set(`108%, ${y}
        109%, ${y}`);

      i += 1;
    });
  });

  let now = w.line();
  now.color('lightgrey');
  now.width(1);
  let iso = spacetime.now().format('iso');
  let y = (i * 10) + 25 + 'px';
  now.set(`${iso}, 14px
    ${iso}, ${y}`);

  w.y.fit(0, 9);
  w.x.fit('Jan 1 2018', 'Dec 31 2018');
  w.xAxis.ticks(12);
  w.yAxis.remove();


  w.build();
};

let chosen = Object.keys(cities).slice(0, 5);
el.innerHTML = chosen.reduce((str, k) => {
  let id = k.replace(/[ \.,]/g, '').toLowerCase();
  str += `<div id="${id}"> </div>`;
  return str;
}, '');

chosen.forEach((k) => {
  let id = k.replace(/[ \.,]/g, '').toLowerCase();
  drawCity(k, '#' + id);
});
// drawCity('Boston', '#Boston');
// drawCity('Toronto', '#Toronto');
