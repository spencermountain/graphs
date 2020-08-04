import spacetime from 'spacetime'

export const getSunSet = function (d, lat) {
  d = d.time('3pm')
  // find sunset time
  for (let i = 0; i < 100; i += 1) {
    d = d.add(5, 'minute')
    d = d.in([lat, 0])
    if (d.sunPosition().altitude < 0) {
      break
    }
  }
  return d
}

export const getSunRise = function (d, lat) {
  d = d.time('3am')
  // find sunset time
  for (let i = 0; i < 100; i += 1) {
    d = d.add(5, 'minute')
    d = d.in([lat, 0])
    if (d.sunPosition().altitude > 0) {
      break
    }
  }
  return d
}

export const calcYear = function (lat) {
  let s = spacetime()
  let weeks = []
  s = s.startOf('year')
  let hours = s.every('week', s.endOf('year'))
  hours.forEach((d, i) => {
    d = d.in([lat, 0])
    let set = getSunSet(d, lat)
    let rise = getSunRise(d, lat)
    set = set.in([lat, 0])

    weeks.push({
      id: i,
      date: set.format('{month-short} {date}'),
      time: set.time(),
      sunset: set.sunPosition().azimuth,
      sunrise: rise.sunPosition().azimuth,
    })
  })
  return weeks
}
