let somehow = require('somehow')
let data = require('./capacity')

let w = somehow({
  // height: 300,
  // aspect: 'golden'
})

data = data.sort((a, b) => {
  if (a[1] > b[1]) {
    return 1
  } else if (a[1] < b[1]) {
    return -1
  }
  return 0
})

data.forEach((a, i) => {
  let y = i * 10
  w.line().set([[0, y], [a[1], y]])
  w.text(a[0])
    .set([[a[1], y]])
    .font(1.5)
    .dy(-2.5)
})

w.title('By capacity:')
w.xAxis.remove()
w.yAxis.remove()
w.fit()

document.querySelector('#graph').innerHTML = w.build()
