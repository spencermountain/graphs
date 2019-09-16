const somehow = require('somehow')

//days in earth-hours
//year numbers in earth-days
const planets = [
  { name: 'mercury', day: 1408, year: 87.969, color: 'brown' },
  { name: 'venus', day: 5832, year: 224.701, color: 'yellow' },
  { name: 'earth', day: 23.56, year: 365.256, color: 'blue' },
  { name: 'mars', day: 24.37, year: 686.98, color: 'red' }
  // { name: 'jupiter', day: 9.83, year: 4332.589, color: 'yellow' },
  // { name: 'saturn', day: 10.33, year: 10759.22, color: 'orange' }
  // { name: 'uranus', day: 17, year: 30685.4, color: 'sky' }
  // { name: 'neptune', day: 16, year: 60189, color: 'blue' }
  // { name: 'pluto', day: 153.3, year: 90465, color: 'navy' }
]
let graphs = planets.map(obj => {
  let year = obj.year * 23.56
  let w = somehow({
    height: 40,
    width: 800
  })

  //draw days
  let dayCount = 0
  for (let n = 0; n < year; n += obj.day) {
    // console.log(n, obj.name)
    w.line()
      .set([[n, 2], [n + obj.day * 0.7, 2]])
      .color(obj.color)
    dayCount += 1
  }
  console.log(dayCount, obj.name)

  w.line()
    .set([[0, 1], [year, 1]])
    .color('grey')

  w.text(obj.name).set([[0, '100%']])

  w.y.fit(0, 2)
  w.yAxis.remove()
  w.xAxis.remove()
  w.x.fit(0, year * 1.1)
  return w.build()
})

let el = document.querySelector('#stage')
el.innerHTML = graphs.join('')
