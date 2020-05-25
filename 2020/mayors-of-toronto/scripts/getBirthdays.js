const wtf = require('/Users/spencer/mountain/wtf_wikipedia')
wtf.extend(require('/Users/spencer/mountain/wtf_wikipedia/plugins/person'))
const spacetime = require('spacetime')
const mayors = require('../data')
let all = []

const getDates = async function (name) {
  let doc = await wtf.fetch(name)
  let born = doc.birthDate()
  let died = doc.deathDate()
  born = spacetime(born).format('iso-short')
  died = spacetime(died).format('iso-short')
  return { born, died }
}

;(async () => {
  for (const mayor of mayors) {
    let dates = await getDates(mayor[0])
    let res = {
      name: mayor[0],
      born: dates.born,
      died: dates.died,
      start: mayor[1],
      end: mayor[2],
    }
    console.log(res)
    all.push(res)
    console.log(JSON.stringify(all, null, 2))
  }
})()
