import { writable, derived } from 'svelte/store'
import { calcYear } from './calc'
import spacetime from 'spacetime'
import daylight from 'spacetime-daylight'
spacetime.extend(daylight)

const fmt = function (v) {
  v -= 90
  v *= -1
  return v
}

export let lat = writable(37)

export let ticks = derived(lat, ($lat) => {
  let l = fmt($lat)
  // console.log(l)
  let weeks = calcYear(l)
  return weeks
})
