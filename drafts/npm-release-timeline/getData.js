import semver from 'semver'
import spacetime from 'spacetime'

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

const format = function (data) {
  let times = data.time || {}
  let keys = Object.keys(times).filter((k) => {
    return semver.valid(k)
  })
  return keys.map((sem) => {
    let d = spacetime(times[sem])
    return {
      date: d,
      type: parseRelease(sem),
      version: sem,
    }
  })
}

const getData = async function (repo) {
  let url = `https://registry.npmjs.cf/${repo}`
  let res = await fetch(url, { mode: 'cors' })
  let data = await res.json()
  let end = format(data)
  // console.log(end)
  return end
}
export default getData
