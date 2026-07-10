import spacetime from 'spacetime'

// sun-position math ported from suncalc (BSD, Vladimir Agafonkin), as used by
// the old spacetime-daylight plugin. lng is fixed at 0 (greenwich), like the
// original's `.in([lat, 0])` — so we work in utc throughout.
export const tz = 'utc'

const rad = Math.PI / 180
const dayMs = 86400000
const J1970 = 2440588
const J2000 = 2451545
const E = rad * 23.4397 // obliquity of the earth

const sunCoords = function (d) {
  let M = rad * (357.5291 + 0.98560028 * d) // solar mean anomaly
  let C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) // equation of center
  let L = M + C + rad * 102.9372 + Math.PI // ecliptic longitude
  return {
    dec: Math.asin(Math.sin(E) * Math.sin(L)),
    ra: Math.atan2(Math.sin(L) * Math.cos(E), Math.cos(L)),
  }
}

// azimuth + altitude in degrees. azimuth: 0=south, +90=west, -90=east
export const sunPosition = function (epoch, lat) {
  let d = epoch / dayMs - 0.5 + J1970 - J2000
  let phi = rad * lat
  let { dec, ra } = sunCoords(d)
  let H = rad * (280.16 + 360.9856235 * d) - ra // sidereal time at lng=0
  return {
    azimuth: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / rad,
    altitude: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / rad,
  }
}

// step forward from 3pm in 5min increments until the sun dips below the horizon
export const getSunSet = function (d, lat) {
  d = d.time('3pm')
  for (let i = 0; i < 100; i += 1) {
    d = d.add(5, 'minute')
    if (sunPosition(d.epoch, lat).altitude < 0) {
      break
    }
  }
  return d
}

// step forward from 3am until the sun clears the horizon
export const getSunRise = function (d, lat) {
  d = d.time('3am')
  for (let i = 0; i < 100; i += 1) {
    d = d.add(5, 'minute')
    if (sunPosition(d.epoch, lat).altitude > 0) {
      break
    }
  }
  return d
}

// sunrise/sunset azimuths for each week of the current year
export const calcYear = function (lat) {
  let s = spacetime.now(tz).startOf('year')
  let weeks = s.every('week', s.endOf('year'))
  return weeks.map((d, i) => {
    let set = getSunSet(d, lat)
    let rise = getSunRise(d, lat)
    return {
      id: i,
      date: set.format('{month-short} {date}'),
      sunset: sunPosition(set.epoch, lat).azimuth,
      sunrise: sunPosition(rise.epoch, lat).azimuth,
    }
  })
}
