const colors = require('spencer-color').colors
const leagues = {
  mls: {
    color: colors.brown,
    start: 'March 3',
    end: 'October 28',
    playoff: 'Dec 8'
  },
  nfl: {
    color: colors.orange,
    start: 'September 6',
    end: 'Dec 30',
    playoff: 'February 3'
  },
  mlb: {
    color: colors.blue,
    start: 'March 29',
    end: 'October 1',
    playoff: 'Oct 28'
  },
  nhl: {
    color: colors.red,
    start: 'October 3',
    end: 'April 6',
    playoff: 'June 13'
  },
  nba: {
    color: colors.green,
    start: 'October 16',
    end: 'April 10',
    playoff: 'June 8'
  },
};
module.exports = leagues
