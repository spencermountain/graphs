const wtf = require('wtf_wikipedia');
// const mlb = require('wtf-mlb')

const getRows = function(table) {
  let rows = table.json();
  rows.forEach((o) => {
    o.Team = o.Team || o['Club'];
    o.Stadium = o.Stadium || o['Arena'] || o['Stadium]]'];
  });
  rows = rows.filter((o) => o.Stadium.links);
  console.log(rows);
  rows = rows.map((o) => {
    let num = o.Capacity.text || '';
    num = num.replace(/,/, '');
    num = num.replace(/ 4$/, '');
    num = Number(num) || num;
    return {
      team: o.Team.links[0].page,
      stadium: o.Stadium.text,
      capacity: num
    };
  });
  return rows;
};

(async () => {
  let stadiums = {};

  var doc = await wtf.fetch('National_Hockey_League');
  let table = doc.section('list of teams').tables(0);
  stadiums.nhl = getRows(table);

  doc = await wtf.fetch('Major_League_Baseball');
  table = doc.section('teams').tables(0);
  stadiums.mlb = getRows(table);

  doc = await wtf.fetch('National_Basketball_Association');
  table = doc.section('teams').tables(0);
  stadiums.nba = getRows(table);

  doc = await wtf.fetch('National_Football_League');
  table = doc.section('teams').tables(0);
  stadiums.nfl = getRows(table);
  //
  doc = await wtf.fetch('Major_League_Soccer');
  table = doc.section('current').tables(0);
  stadiums.mls = getRows(table);

  console.log(stadiums);
})();
