const somehow = require('somehow');
let years = require('./data/bluejays')
years = years.sort((a, b) => a.year < b.year ? 1 : -1)

let w = somehow({
  height: 200,
  width: 1200
// aspect: 'widescreen',
});

years = years.slice(0, 1)
years.forEach((o) => {
  let line = w.line().width(2)
  let arr = o.games.map((a) => {
    return [a[0] + ' ' + o.year, a[1]]
  })
  arr = arr.filter((a) => a[1])
  console.log(arr[0])
  // console.log(arr)
  line.set(arr)
})

w.line().color('lightgrey').width(1).dotted(true).set(`
0%, 53506
100%, 53506
`)

w.y.fit(0, 60000);
w.x.fit('Mar 1 2018', 'Oct 31 2018');
// w.x.fit();

let el = document.querySelector('#stage');
el.innerHTML = w.build()
