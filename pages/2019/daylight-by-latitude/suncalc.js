// sunrise/sunset math, ported from suncalc (github.com/mourner/suncalc, BSD-2)
// formulas from http://aa.quae.nl/en/reken/zonpositie.html
const { sin, cos, tan, asin, acos, atan2, PI } = Math
const rad = PI / 180
const dayMs = 1000 * 60 * 60 * 24
const J1970 = 2440588
const J2000 = 2451545
const J0 = 0.0009
const e = rad * 23.4397 // obliquity of the earth

const toJulian = (date) => date.valueOf() / dayMs - 0.5 + J1970
const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs)
const toDays = (date) => toJulian(date) - J2000

const declination = (l, b) => asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l))
const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d)
const eclipticLongitude = function (M) {
  let C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)) // equation of center
  let P = rad * 102.9372 // perihelion of the earth
  return M + C + P + PI
}
const julianCycle = (d, lw) => Math.round(d - J0 - lw / (2 * PI))
const approxTransit = (Ht, lw, n) => J0 + (Ht + lw) / (2 * PI) + n
const solarTransitJ = (ds, M, L) => J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L)
const hourAngle = (h, phi, d) => acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d)))

// sunrise + sunset times for a date at lat/lng
export const getTimes = function (date, lat, lng) {
  const lw = rad * -lng
  const phi = rad * lat
  const d = toDays(date)
  const n = julianCycle(d, lw)
  const ds = approxTransit(0, lw, n)
  const M = solarMeanAnomaly(ds)
  const L = eclipticLongitude(M)
  const dec = declination(L, 0)
  const Jnoon = solarTransitJ(ds, M, L)
  const w = hourAngle(-0.833 * rad, phi, dec) // sun 0.833° below horizon
  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L)
  const Jrise = Jnoon - (Jset - Jnoon)
  return {
    sunrise: fromJulian(Jrise),
    sunset: fromJulian(Jset),
    solarNoon: fromJulian(Jnoon),
  }
}
export default { getTimes }
