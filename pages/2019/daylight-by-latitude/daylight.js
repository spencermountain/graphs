// daylight calculations, ported from the 2019 index.js/circle.js/byDay.js
// (each keeps the lng value the original happened to use)
import spacetime from 'spacetime'
import { getTimes } from './suncalc.js'

const tz = 'Canada/Eastern' // original hardcoded a toronto-ish view

// whole minutes of daylight on a date (like spacetime's .diff().minutes)
const daylightMinutes = function (date, lat, lng) {
  let t = getTimes(date, lat, lng)
  return Math.floor((t.sunset.getTime() - t.sunrise.getTime()) / 60000)
}
const daylightHours = (date, lat, lng) => daylightMinutes(date, lat, lng) / 60

// [{epoch, hours}] at the start of each week of the year (lng=0)
export const weekly = function (year, lat) {
  let arr = []
  let s = spacetime([year, 0, 1])
  for (let i = 0; i <= 52; i++) {
    arr.push({ epoch: s.epoch, hours: daylightHours(s.d, lat, 0) })
    s = s.add(1, 'week')
  }
  return arr
}

// change in day-length over each month → {hours, minutes} (lng=-79)
export const monthly = function (year, lat) {
  let arr = []
  let s = spacetime([year, 0, 1], tz)
  for (let i = 0; i < 12; i++) {
    let start = daylightHours(s.d, lat, -79)
    s = s.endOf('month')
    let diff = daylightHours(s.d, lat, -79) - start
    let hours = Math.trunc(diff)
    arr.push({ hours, minutes: Math.trunc((diff - hours) * 60) })
    s = s.next('month')
  }
  return arr
}

// minutes gained per day + per week around an equinox (lng=0)
const gains = function (s, lat) {
  let mins = daylightMinutes(s.d, lat, 0)
  return {
    day: daylightMinutes(s.add(1, 'day').d, lat, 0) - mins,
    week: daylightMinutes(s.add(1, 'week').d, lat, 0) - mins,
  }
}
export const equinoxes = function (year, lat) {
  return {
    spring: gains(spacetime([year, 2, 20]), lat), // march 20
    fall: gains(spacetime([year, 8, 22]), lat), // sept 22
  }
}

// day-length in hours at july 21 + dec 21 (lng=-0.1, for the 'hr diff' label)
export const solstices = function (year, lat) {
  return {
    summer: daylightHours(spacetime([year, 6, 21], tz).d, lat, -0.1),
    winter: daylightHours(spacetime([year, 11, 21], tz).d, lat, -0.1),
  }
}

// sunrise→sunset as a % of the day, for the clock-circle (lng=-79)
const dayArc = function (s, lat) {
  let t = getTimes(s.d, lat, -79)
  let from = spacetime(t.sunrise.getTime(), tz).progress('day') * 100
  let to = spacetime(t.sunset.getTime(), tz).progress('day') * 100
  if (from > 90) {
    from -= 100 // wraparound guard, from the original
  }
  return { from, to }
}
export const arcs = function (year, lat) {
  return {
    summer: dayArc(spacetime([year, 6, 21], tz), lat),
    winter: dayArc(spacetime([year, 11, 21], tz), lat),
  }
}
