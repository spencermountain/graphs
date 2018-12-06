const data = require('../data/stadiums');

let arr = [].concat(data.nfl);
arr = arr.concat(data.nhl);
arr = arr.concat(data.nba);
arr = arr.concat(data.mlb);
arr = arr.concat(data.mls);

arr.forEach((o, i) => {

  arr.forEach((d, k) => {
    if (i === k) {
      return;
    }
    if (o.stadium === d.stadium) {
      o.shared = o.shared || [];
      o.shared.push(d.team);
    }
  });

});
console.log(data);
