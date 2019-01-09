let el = document.querySelector('#stage');

const somehow = require('somehow');
// const somehow = require('/Users/spencer/mountain/somehow/src/index.js');
console.log(somehow.version)
const spacetime = require('spacetime');
const cities = require('./data/cities');
const leagues = require('./data/leagues');
const latitudes = require('./data/latitudes');
const year = new Date().getFullYear()
let yearEnd = spacetime('Dec 31 ' + year).format('iso-short')
let yearStart = spacetime('Jan 1 ' + year).format('iso');

const draw = {
  nhl: function(w, label, y) {
    let {color, start, end, playoff} = leagues.nhl
    start += ' ' + year
    end += ' ' + year
    playoff += ' ' + year
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
    start += ' ' + year
    end += ' ' + year
    playoff += ' ' + year
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
    start += ' ' + year
    end += ' ' + year
    playoff += ' ' + year
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
    start += ' ' + year
    end += ' ' + year
    playoff += ' ' + year
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
    start += ' ' + year
    end += ' ' + year
    playoff += ' ' + year
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

  //add title+latitude to top
  let city = cities[name];
  let lat = w.text(latitudes[name] + '° ');
  lat.font(11)
  lat.set('-150px, 50%');
  let cityName = w.text(name);
  cityName.set('-125px, 50%');

  let i = 1;
  //draw each team
  Object.keys(leagues).forEach((k) => {
    let league = leagues[k];
    city[k] = city[k] || [];
    city[k].forEach((team) => {
      let y = i * 10 + 'px';
      draw[k](w, team, y)
      // normalize their team name
      team = w.text(team);
      team.font(10);
      team.color('lightgrey');
      team.set([['110%', `${(i * 10) + 3}px`]]);

      let leg = w.line();
      leg.width(2);
      leg.color(league.color);
      y = ((i * 10) + 6) + 'px';
      leg.set(`108%, ${y}
        109%, ${y}`);

      i += 1;
    });
  });

  //draw the today line
  let now = w.line();
  now.color('lightgrey');
  now.dotted(true)
  now.width(1);
  let iso = spacetime.now().format('iso');
  let y = (i * 10) + 25 + 'px';
  now.set(`${iso}, 0px
    ${iso}, ${y}`);

  w.y.fit(0, 9);
  w.x.fit('Jan 1 ' + year, 'Dec 31 ' + year);
  w.xAxis.ticks(12);
  w.yAxis.remove();


  return w.build();
};

let chosen = Object.keys(cities)
chosen = chosen.sort((a, b) => latitudes[a] < latitudes[b] ? 1 : -1)
el.innerHTML = chosen.map((k) => {
  return drawCity(k);
}).join(' ')
// el.innerHTML = drawCity('Boston');
// drawCity('Toronto');
