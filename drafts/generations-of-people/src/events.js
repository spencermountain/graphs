const year = new Date().getFullYear()
const dy = '15px'

const events = [
  ['Dec 5 1492', ['columbus', 'landing']],
  ['Dec 5 1206', ['Genghis', 'Khan']]
  // ['Dec 5 1880', ['Electricity']]
]
// const eras = [
//   ['Dec 5 1550', 'Dec 5 1880', 'english', 'yellow'],
//   ['Dec 5 1880', new Date(), 'electricity', 'pink']
// ]

const showEvents = function(w) {
  //ww2
  w.rect()
    .color('red')
    .set([['Sep 1 1939', '0%'], ['Sep 2 1945', '100%']])
    .rounded(1)
  w.text('WWII')
    .center('Sep 1 1941', '-30px')
    .font(12)

  //ww1
  w.rect()
    .color('red')
    .set([['Jul 28 1914', '0%'], ['Nov 11 1918', '100%']])
    .rounded(1)
  w.text('WWI')
    .center('Sep 1 1916', '-30px')
    .font(12)

  //centuries
  for (let c = 900; c < year; c += 100) {
    w.line()
      .set([[`Jan 1 ${c}`, '0%'], [`Jan 1 ${c}`, '100%']])
      .dotted(true)
      .width(1)
      .color('grey')
  }

  //other events
  events.forEach(event => {
    w.text(event[1])
      .center(event[0], dy)
      .font(12)
  })
  // eras.forEach(era => {
  //   w.line()
  //     .set([[era[0], '110%'], [era[1], '110%']])
  //     .width(4)
  //     .color(era[3])
  //   w.text(era[2])
  //     .after(era[0], '110%')
  //     .font(10)
  //     .color(era[3])
  //     .dx(15)
  //     .dy(2)
  // })

  return w
}
module.exports = showEvents
