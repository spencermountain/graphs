const wtf = require('wtf_wikipedia');
// const mlb = require('wtf-mlb')

const coercePlace = {
  'Sunrise, Florida': 'Miami',
  'East Rutherford, New Jersey': 'Newark, New Jersey',
  'Saint Paul, Minnesota': 'Minneapolis',
  'Glendale, Arizona': 'Phoenix, Arizona',
  'Paradise, Nevada': 'Las Vegas',
  'St. Petersburg, Florida': 'Tampa, Florida',
  'Orchard Park (town), New York': 'Buffalo, New York',
  'Miami Gardens, Florida': 'Miami',
  'Foxborough, Massachusetts': 'Boston',
  'Landover, Maryland': 'Washington, D.C.',
  'Carson, California': 'Los Angeles',
  'Anaheim, California': 'Los Angeles',
  'Santa Clara, California': 'San Jose, California'
};

const getRows = function(table) {
  let rows = table.json();
  rows.forEach((o) => {
    o.City = o.City || o['City/State'];
    if (coercePlace[o.City]) {
      o.City = coercePlace[o.City];
    }
    o.Team = o.Team || o['Club'];
  });
  rows = rows.filter((o) => o.Team.links && o.City.links);
  rows = rows.map((o) => {
    return [
      o.City.links[0].page,
      o.Team.links[0].page,
    ];
  });
  return rows;
};

const toObj = function(arr, obj, league) {
  arr.forEach((a) => {
    let city = a[0];
    obj[city] = obj[city] || {};
    obj[city][league] = obj[city][league] || [];
    obj[city][league].push(a[1]);
  });
  return obj;
};

(async () => {
  let cities = {};

  // var doc = await wtf.fetch('National_Hockey_League');
  // let table = doc.section('list of teams').tables(0);
  // let nhl = getRows(table);
  //
  // doc = await wtf.fetch('Major_League_Baseball');
  // table = doc.section('teams').tables(0);
  // let mlb = getRows(table);
  //
  // doc = await wtf.fetch('National_Basketball_Association');
  // table = doc.section('teams').tables(0);
  // let nba = getRows(table);
  //
  // doc = await wtf.fetch('National_Football_League');
  // table = doc.section('teams').tables(0);
  // let nfl = getRows(table);

  doc = await wtf.fetch('Major_League_Soccer');
  table = doc.section('current').tables(0);
  let mls = getRows(table);
  // cities = toObj(nhl, cities, 'nhl');
  // cities = toObj(mlb, cities, 'mlb');
  // cities = toObj(nba, cities, 'nba');
  // cities = toObj(nfl, cities, 'nfl');
  // cities = toObj(mls, cities, 'mls');

  console.log(cities);
})();


// wtf.fetch('Major_League_Baseball', (err, doc) => {
//   let table = doc.section('teams').tables(0)
//   let rows = table.json()
//   rows = rows.filter((o) => o.Team.links)
//   rows = rows.map((o) => {
//     return [
//       o.City.links[0].page,
//       o.Team.links[0].page,
//     ]
//   })
//   console.log(rows)
// })
// wtf.fetch('National_Basketball_Association', (err, doc) => {
//   let table = doc.section('teams').tables(0)
//   let rows = table.json()
//   rows = rows.filter((o) => o.Team.links && o['City/State'].links)
//   rows = rows.map((o) => {
//     return [
//       o['City/State'].links[0].page,
//       o.Team.links[0].page,
//     ]
//   })
//   console.log(rows)
// })
