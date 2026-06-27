// const somehow = require('somehow')
const somehow = require('/Users/spencer/mountain/somehow-graph/src/index')

let w = somehow({
  height: 200,
  aspect: 'widescreen'
})

w.fit()

/* ===Canada:===
1) cancer: 80k
2) heart-disease: 55k
4) accidents: 13k
6) influenza/pneumonia: 8.5k
7) diabetes: 7k
8) Alzheimers: 6k
9) Suicide: 4k
25) Homicide: 400


Canda: 37.59 million
Ontario: 14.57 million  (38%)
===Ontario!==
1) cancer: 30k          x2=60k
2) heart-disease: 20k   x2=40k
4) accidents: 5k        x2=10k
6) influenza: 3.2k      x2=6.4k
7) diabetes: 2.6k       x2=5k
8) alzheimers: 2.2k     x2=4.4k
9) suicide: 1.55k       x2=3k
25) homicide: 152       x2=300
*/

const data = {
  cancer: 60000, //60k
  heart: 40000,
  accidents: 10000,
  diabetes: 5000,
  suicide: 3000,
  homicide: 300
}

const drawLine = function (name) {
  w.line()
    .color('#a3a5a5')
    .width(1)
    .dotted(4)
    .set([
      ['Jan 1 2020', 0],
      ['April 1 2022', data[name]]
    ])
  let sub = `(${data[name] / 1000}k)`
  // if (data[name] < 20000) {
  //   // name += ' ' + sub
  //   // sub = ''
  // }
  let text = w
    .text([name, sub])
    .color('#a3a5a5')
    .set([['April 1 2022', data[name]]])
    .font(2)
  if (name === 'accidents') {
    text.dy(-3.2)
  }
  if (name === 'suicide') {
    text.dy(-6)
  }
}

// new years
w.line()
  .color('#d7d5d2')
  .width(1)
  .dotted(10)
  .set([
    ['jan 1 2021', 0],
    ['jan 1 2021', 80000]
  ])
w.text(['new years'])
  .center()
  .dy(-1)
  .dx(-2)
  .set([['jan 1 2021', 80000]])
  .color('#d7d5d2')
  .font(2)

w.line()
  .color('#d7d5d2')
  .width(1)
  .dotted(10)
  .set([
    ['jan 1 2022', 0],
    ['jan 1 2022', 80000]
  ])

// projection (bad)
w.line()
  .color('#50617A')
  .width(1)
  .dotted(10)
  .set([
    ['March 22 2020', 0],
    ['April 1 2022', 100000]
  ])
w.text(['covid', 'no quarantine', '(100k)'])
  .set([['April 1 2022', 100000]])
  .color('#50617A')
  .font(2)

w.area()
  .color('purple')
  .set([
    ['March 22 2020', 0, 0],
    ['April 1 2022', 15000, 3000]
    // ['April 1 2022', 3000]
  ])
w.text(['covid projection', '(3k - 15k)'])
  .center()
  .bold()
  .dy(-2)
  .dx(3)
  .set([['sept 1 2021', 15000]])
  .color('purple')
  .font(3)

drawLine('cancer')
drawLine('heart')
drawLine('accidents')
drawLine('suicide')

w.fit()
w.x.fit('Jan 1 2020', 'April 1 2022')
let el = document.querySelector('#stage')
el.innerHTML = w.build()
