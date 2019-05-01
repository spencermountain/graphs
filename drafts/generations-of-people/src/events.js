//
const dy = '-30px'

const events = [['Dec 5 1492', ['columbus', 'landing']]]

const showEvents = function(w) {
  //ww2
  w.rect()
    .color('red')
    .set([['Sep 1 1939', '0%'], ['Sep 2 1945', '100%']])
    .rounded(1)
  w.text('WWII')
    .center('Sep 1 1941', dy)
    .font(12)

  //ww1
  w.rect()
    .color('red')
    .set([['Jul 28 1914', '0%'], ['Nov 11 1918', '100%']])
    .rounded(1)
  w.text('WWI')
    .center('Sep 1 1916', dy)
    .font(12)

  //centuries
  const centuries = [2000, 1900, 1800, 1700]
  centuries.forEach(c => {
    w.line()
      .set([[`Jan 1 ${c}`, '0%'], [`Jan 1 ${c}`, '100%']])
      .dotted(true)
      .width(1)
      .color('grey')
  })

  //other events
  events.forEach(event => {
    w.line()
      .set([[event[0], '0%'], [event[0], '100%']])
      .dotted(true)
      .width(1)
      .color('sky')
    w.text(event[1])
      .center(event[0], dy)
      .font(12)
  })

  return w
}
module.exports = showEvents
