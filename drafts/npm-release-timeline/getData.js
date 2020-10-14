import semver from 'semver'
import spacetime from 'spacetime'
import mock from './compromise.js'

const parseRelease = function (str) {
  let obj = semver.parse(str) || {}
  if (obj.patch === 0) {
    if (obj.minor === 0) {
      return 'major'
    }
    return 'minor'
  }
  return 'patch'
}

const format = function () {
  // let times = data.time || {}
  let keys = Object.keys(mock).filter((k) => {
    return semver.valid(k)
  })
  return keys.map((sem) => {
    let d = spacetime(mock[sem])
    // console.log(times[sem])
    return {
      date: d.format('iso-short'),
      type: parseRelease(sem),
      version: sem,
    }
  })
}

const getData = async function (repo) {
  let url = `https://registry.npmjs.cf/${repo}`
  let res = await fetch(url, { mode: 'cors' })
  let data = await res.json()
  return format(data)
}
export default getData
