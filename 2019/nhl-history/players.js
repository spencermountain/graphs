const somehow = require('somehow');
const colors = require('./data/colors')
const today = new Date().toISOString()
const year = new Date().getFullYear()
const players = [
  ['Maurice Richard', 1942, 1960, 'Montreal Canadiens'],
  ['Gordie Howe', 1946, 1980, 'Detroit Red Wings'],
  // ['Jean Beliveau', 1950, 1971,'Montreal Canadiens'],
  ['Bobby Hull', 1957, 1980, 'Chicago Blackhawks'],
  // ['Phil Esposito', 1963, 1981, 'Boston Bruins'],
  ['Bobby Orr', 1966, 1978, 'Boston Bruins'],
  ['Bobby Clarke', 1969, 1984, 'Philadelphia Flyers'],
  ['Wayne Gretzky', 1979, 1999, 'Edmonton Oilers'],
  // ['Mark Messier', 1979, 2004],
  ['Steve Yzerman', 1983, 2006, 'Detroit Red Wings'],
  ['Mario Lemieux', 1984, 2005, 'Pittsburgh Penguins'],
  // ['Jaromír Jágr', 1990, 2018],
  ['Sidney Crosby', 2005, year, 'Pittsburgh Penguins'],
// ['Connor McDavid', 2015, year],
]

let w = somehow({
  height: 200,
  width: 700,
});
players.forEach((a, i) => {
  w.line().color(colors[a[3]] || 'red').width(1).set([
    ['Oct 1 ' + a[1], i],
    ['Apr 1 ' + a[2], i]
  ])
  w.text(a[0]).at('Oct 1 ' + a[1], i)
})


// w.text('Players:').at('0px', '100%')
w.fit()
w.x.fit('Jan 1 1942', today)
w.y.fit(-1)
w.yAxis.remove()

let el = document.querySelector('#players');
el.innerHTML = w.build()
