// const year = new Date().getFullYear()

const firstName = str => {
  let arr = str.split(' ')
  return arr.slice(0, arr.length - 1).join(' ')
}

const toCouples = function(root) {
  let couples = []
  const doit = function(people, id) {
    let m = people[0] || {}
    let f = people[1] || {}
    if (!f.name && !m.name) {
      return
    }
    let name = `${firstName(f.name)} / ${firstName(m.name)}`
    couples.push({
      name: name,
      id: id,
      x: id.length,
      m: [m.birth, m.death || m.birth + 80],
      f: [f.birth, f.death || f.birth + 80]
    })
    if (m.parents) {
      doit(m.parents, id + 'm')
    }
    if (f.parents) {
      doit(f.parents, id + 'f')
    }
  }
  doit(root.parents, '')

  return couples
}

module.exports = {
  toCouples: toCouples
}
