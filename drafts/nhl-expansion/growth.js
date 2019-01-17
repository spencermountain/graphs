const somehow = require('somehow');
// const somehow = require('/Users/spencer/mountain/somehow');
const spencerColor = require('spencer-color');
const today = new Date().toISOString()

let data = [
  ['Oct 1 1942', 6],
  ['Oct 1 1967', 12], //la, phili, pitsburg, st louis
  ['Oct 1 1970', 14], //buffalo, vancouver
  ['Oct 1 1972', 16], //buffalo, vancouver
  ['Oct 1 1974', 18], //Washington, kansas
  ['Oct 1 1978', 17], //shrink
  ['Oct 1 1979', 21], //edmonton, hartford, quebec, winnipeg
  ['Oct 1 1991', 22], //san jose
  ['Oct 1 1992', 22], //Ottawa, tampa bay
  ['Oct 1 1993', 26], //florida, anaheim
  ['Oct 1 1998', 27], //nashville
  ['Oct 1 1999', 28], //atlanta
  ['Oct 1 2000', 30], //Columbus, minnesota
  ['Oct 1 2016', 31], // Las Vegas
  ['Oct 1 2018', 31],
  ['Oct 1 2020', 32], //seattle
]

//add-in the end-of-season
let points = []
data.forEach((a, i) => {
  if (i === 0) {
    points.push(a)
    return
  }
  let date = a[0].replace(/Oct 1 /, 'May 1 ')
  let last = [date, data[i - 1][1]]
  points.push(last)
  points.push(a)
})
// console.log(points)

let w = somehow({
  height: 400,
  width: 700,
});

let mid = w.midArea().color('blue')
// mid.straight()
// mid.soft()
mid.attrs.stroke = spencerColor.colors.green
mid.set(points)

w.annotation(['original', 'six']).font(12).on('Oct 1 1942', 3).nudge(-70, 20)
w.annotation(['1967', 'league', 'doubles', 'to 12']).font(12).on('Apr 1 1967', 3).nudge(-120, 50)
w.annotation(['1960s', 'league adds 2 teams', 'every 2 years']).font(12).on('Oct 1 1971', 14 / 2).nudge(70, -60)
w.annotation(['1979', 'edmonton,', 'quebec,', 'winnipeg']).font(12).on('Oct 1 1979', -10).nudge(-90, -70)
w.annotation(['2000', 'columbus', 'minnesota']).font(12).on('Oct 1 2000', 30 / 2).nudge(40, -80)
w.annotation(['1978', 'league shrinks']).font(12).on('Sept 1 1978', 17 / 2).nudge(-120, 40)
w.annotation(['1993', 'flordia,', 'anaheim']).font(12).on('Sept 1 1993', 26 / 2).nudge(0, 50)
w.annotation(['2016', 'Las Vegas']).font(12).on('Sept 1 2016', 31 / 2).nudge(-80, 50)
w.annotation(['2020', 'Seattle']).font(12).on('Sept 1 2019', -16).nudge(-80, -35)


// w.fit()
w.text('NHL Expansion:').at('0px', '100%')
w.x.fit('Jan 1 1942', today)
w.y.fit(-28, 28)
w.yAxis.remove()

let el = document.querySelector('#growth');
el.innerHTML = w.build()
