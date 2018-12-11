let el = document.querySelector('#stage');

const somehow = require('./assets/somehow');
// const somehow = require('/Users/spencer/mountain/somehow/src/index.js');
const spacetime = require('spacetime');
const cities = require('./data/cities');
const leagues = require('./data/leagues');
const latitudes = require('./data/latitudes');
let yearEnd = spacetime('Dec 31 2018');
let yearStart = spacetime('Jan 1 2018').format('iso');

const draw = {
  nhl: function(w, label, y) {
    let {color, start, end, playoff} = leagues.nhl
    w.line().color(color).set([
      [start, y],
      [yearEnd, y]
    ]);
    w.line().color(color).set([
      [yearStart, y],
      [end, y]
    ]);
    w.line().color(color).opacity(0.4).dotted(5).set([
      [end, y],
      [playoff, y]
    ]);
  },
  mlb: (w, label, y) => {
    let {color, start, end, playoff} = leagues.mlb
    w.line().color(color).set([
      [start, y],
      [end, y]
    ]);
    w.line().color(color).opacity(0.4).dotted(5).set([
      [end, y],
      [playoff, y]
    ]);
  },
  nba: (w, label, y) => {
    let {color, start, end, playoff} = leagues.nba
    w.line().color(color).set([
      [start, y],
      [yearEnd, y]
    ]);
    w.line().color(color).set([
      [yearStart, y],
      [end, y]
    ]);
    w.line().color(color).opacity(0.4).dotted(5).set([
      [end, y],
      [playoff, y]
    ]);
  },
  nfl: (w, label, y) => {
    let {color, start, end, playoff} = leagues.nfl
    w.line().color(color).set([
      [end, y],
      [start, y]
    ]);
    w.line().color(color).opacity(0.4).dotted(5).set([
      [yearStart, y],
      [playoff, y]
    ]);
  },
  mls: (w, label, y) => {
    let {color, start, end, playoff} = leagues.mls
    w.line().color(color).set([
      [start, y],
      [end, y]
    ]);
    w.line().color(color).opacity(0.4).dotted(5).set([
      [end, y],
      [playoff, y]
    ]);
  },
}

const drawCity = function(name) {
  if (!latitudes[name]) {
    console.log(name)
  }
  let w = somehow({
    height: 200,
    aspect: 'widescreen',
  });
  let city = cities[name];
  let lat = w.text(latitudes[name] + '° ');
  lat.font(11)
  lat.set('-150px, 50%');
  let cityName = w.text(name);
  cityName.set('-125px, 50%');

  let i = 1;
  Object.keys(leagues).forEach((k) => {
    let league = leagues[k];
    city[k] = city[k] || [];
    city[k].forEach((team) => {
      let y = i * 10 + 'px';
      draw[k](w, team, y)
      //draw the main-line
      // if (k === 'nhl' || k === 'nba' || k === 'nfl') {
      //   drawTwoLines(w, league.start, league.end, y, team, league.color);
      // } else {
      //   drawLine(w, league.start, league.end, y, team, league.color);
      // }
      //draw the playoff line
      // drawPlayoff(w, league.end, league.playoff, y, team, league.color);


      //normalize their team name
      team = w.text(team);
      team.font(10);
      team.color('lightgrey');
      team.set(`110%, ${(i * 10) + 3}px`);
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
  now.dotted(true)
  now.width(1);
  let iso = spacetime.now().format('iso');
  let y = (i * 10) + 25 + 'px';
  now.set(`${iso}, 0px
    ${iso}, ${y}`);

  w.y.fit(0, 9);
  w.x.fit('Jan 1 2018', 'Dec 31 2018');
  w.xAxis.ticks(12);
  w.yAxis.remove();


  return w.build();
};

let chosen = Object.keys(cities)
chosen = chosen.sort((a, b) => latitudes[a] < latitudes[b] ? 1 : -1)
el.innerHTML = chosen.map((k) => {
  return drawCity(k);
}).join(' ')

// drawCity('Boston');
// drawCity('Toronto');
