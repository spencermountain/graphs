// const somehow = require('somehow');
const somehow = require('/Users/spencer/mountain/somehow/src');
const data = require('./data/toronto-montreal');
require('./_canada');

let w = somehow({
  height: 200,
  aspect: 'widescreen',
});

let toronto = data[0].years.map((a) => {
  a[0] = 'Jan 1 ' + String(a[0]);
  return a;
});
let tor = w.line().color('blue');
tor.set(toronto);

let montreal = data[1].years.map((a) => {
  a[0] = 'Jan 1 ' + String(a[0]);
  return a;
});
let mon = w.line().color('orange');
mon.set(montreal);
// console.log(montreal)

// == Montreal ==
// 1642 - founding of montreal
// 1861 - horse-drawn carts
// 1867 - confederation
// 1918 - tunnel under mount royal
// 1930, May 14 - Jacques Cartier Bridge
// 1941, September 1 - Trudeau (Dorval) airpot
// 1960, October 14 - Montreal metro
// 1967, April 27  - Expo '67
// 1969, February 13 - stock exchange bombing
// 1969, April 8 - Expos start
// 1970 - FLQ crisis
// 1975, November 29 - Mirabel airport opens
// 1976, July 17  - Hosts Olympics
// 1977 - French Language Charter (Bill 101)
// 1980, May 20 - First independence referendum
// 1980, June 22 - terry fox in Montreal
// 1994, August 12 - MLB player's strike (Expos 74–40)
// 1995, October 30 - Second independence referendum
// 2002 -> 2004  - amalgamation/de-amalgamation
// 2004 - Mirabel shuts-down passenger flights
// 2004 - Expos leave to Washington
// 2013 - first cruise ships at port
//2017, December 10 - TSX Group acquires Montreal Exchange

// == Toronto ==
// 1750 - 1759 - french settlement (abandoned)
// 1787 - toronto purchase
// 1813 - surrender of Toronto to Americans
// 1845 - Irish potato famine
// 1867 - confederation
// 1875 - Irish/Catholic riot on Spadina
// 1892 - horse -> electric streetcar
// 1927, August 6 - Union Station (#3) completed
// 1933, 16 August - Christie pitts riot
// 1954, March 30 -> Yonge subway
// 1966, February 25 -> Bloor subway
// 1976, CN Tower completed
// 1977, Blue Jays start
// 1980, July 11 - terry fox welcomed in Toronto
// 1989 Skydome built

// w.y.fit(0, 2615060);
// w.x.fit(toronto[0][0], 'Jan 1 2018');
w.fit();

let el = document.querySelector('#stage');
el.innerHTML = w.build();
