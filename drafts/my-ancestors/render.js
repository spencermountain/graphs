const year = new Date().getFullYear()
let genSize = [100, 50, 25, 12.5, 6.25]

const calculateY = function(id) {
  let chars = id.split('')
  let y = 0
  chars.forEach((c, i) => {
    let size = genSize[i]
    if (c === 'm') {
      y += size
    } else {
      y -= size
    }
  })
  return y
}

const drawTree = function(w, couples) {
  couples.forEach(c => {
    let y = calculateY(c.id)
    w.line()
      .set([[c.x, y], [c.x + 2, y]])
      .color('grey')
    w.text(c.name)
      .set(c.x, y)
      .font(8)
      .dy(3)
  })
  w.y.fit()
  w.x.fit(0, 8)
}

const drawLifespan = function(w, couples) {
  couples.forEach(c => {
    let y = calculateY(c.id)
    //men
    w.line()
      .set([[`jan 1 ${c.m[0]}`, y], [`jan 1 ${c.m[1]}`, y]])
      .color('blue')

    //women
    w.line()
      .set([[`jan 1 ${c.f[0]}`, y - 3], [`jan 1 ${c.f[1]}`, y - 3]])
      .color('tulip')
    // .dy(3)

    w.text(c.name)
      .before(`jan 1 ${c.m[0]}`, y)
      .font(8)
      .dy(3)
      .dx(-25)
  })
  w.y.fit(-200, 200)
  w.x.fit('jan 1 ' + year, 'jan 1 1800')
}
module.exports = {
  drawTree: drawTree,
  drawLifespan: drawLifespan
}
