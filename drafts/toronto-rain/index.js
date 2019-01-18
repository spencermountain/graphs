const somehow = require('somehow');
const years = {
  2019: require('./data/2019-toronto'),
  2018: require('./data/2018-toronto'),
  2017: require('./data/2017-toronto'),
  2016: require('./data/2016-toronto'),
  2015: require('./data/2015-toronto'),
  2014: require('./data/2014-toronto'),
  2013: require('./data/2013-toronto'),
  2012: require('./data/2012-toronto'),
  2011: require('./data/2011-toronto'),
}

const doYear = function(year) {
  let w = somehow({
    height: 200,
    aspect: 'widescreen',
  });
  let days = years[year]
  days.forEach((d) => {
    if (d.rain) {
      let bar = w.bar().color('blue').at(d.date, d.rain)
      bar.attrs.title = d.date
    }
  })
  w.text(String(year)).at('0%', '90%')
  w.y.fit(0, 3);
  w.x.fit(`Jan 1 ${year}`, `Dec 31 ${year}`);
  w.yAxis.remove()
  document.querySelector(`#year${year}`).innerHTML = w.build()
}
doYear(2019)
doYear(2018)
doYear(2017)
doYear(2016)
doYear(2015)
doYear(2014)
doYear(2013)
doYear(2012)
doYear(2011)


//2018 aug 8

//2017 july - https://globalnews.ca/news/3612904/toronto-under-flood-warning-with-some-roads-closed-due-to-flooding/
//2017 may 1 - toronto island - https://globalnews.ca/video/3418709/toronto-under-flood-watch

// 2014 oct 17 - https://www.cbc.ca/news/canada/toronto/raw-toronto-flood-aftermath-1.2802601
//2014 june 25 - https://globalnews.ca/video/1417301/heavy-downpour-floods-parts-of-toronto-wednesday
//2014 may 27 - https://globalnews.ca/video/1357804/raw-video-heavy-rains-bring-floods-to-parts-of-toronto

//2013 july 8 - extreme https://globalnews.ca/news/708703/health-officials-warn-about-contaminated-flood-waters/ https://globalnews.ca/news/1439081/city-urges-storm-preparedness-on-anniversary-of-toronto-floods/
//2013 april 13

//2012 dec 28 - snow - https://nationalpost.com/news/toronto/snowfall-in-toronto-by-the-numbers

//2011 March 23 - big snowstorm?
// 1999 mel lastman army
