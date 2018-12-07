const colors = require('spencer-color');

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
module.exports = leagues
