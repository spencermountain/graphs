// timeline constants + data, from the 2021 Post.svelte
import spacetime from 'spacetime'

export const HEIGHT = 800
export const START = '1900'
export const END = 'Dec 30 2021'

const s0 = spacetime(START).epoch
const s1 = spacetime(END).epoch

// date string → px from the top (tiny scaleLinear, truncated like the original)
export const scale = (date) => Math.trunc(HEIGHT * ((spacetime(date).epoch - s0) / (s1 - s0)))

// left column — typewriter models
export const typewriters = [
  { start: '1910', end: '1917', color: 'sky', label: 'Standard', dodge: '40px', opacity: '0.4' },
  { start: '1917', end: '1929', color: 'blue', label: 'Portable', dodge: '40px', align: 'left', opacity: '0.4' },
  { start: '1929', end: '1933', color: 'sky', label: 'Varityper', dodge: '40px', opacity: '0.4' },
  { start: '1933', end: '1939', color: 'orange', label: 'Electromatic', dodge: '40px', align: 'left', opacity: '0.4' },
  { start: '1939', end: '1960', color: '#cc7c66', label: 'Automatic', dodge: '40px', opacity: '0.4' },
  { start: '1960', end: '1964', color: 'fire', label: 'Selectric', dodge: '40px', align: 'left', opacity: '0.4' },
  { start: '1964', end: '1968', color: 'red', label: 'MG/ST', dodge: '40px', opacity: '0.4' },
]

// right column — early computer models
export const computers = [
  { start: '1936', end: '1942', label: 'Z1', size: '11px', dodge: '40px', color: 'pink', align: 'left' },
  { start: '1943', end: '1947', label: 'Eniac', size: '11px', dodge: '40px', color: 'lightblue' },
  { start: '1947', end: '1951', label: 'IBM 701', size: '11px', dodge: '40px', color: 'pink', align: 'left' },
  { start: '1951', end: '1955', label: 'Z4', size: '11px', dodge: '40px', color: 'lightblue', align: 'left' },
  { start: '1956', end: '1962', label: 'RAMAC', size: '11px', dodge: '40px', color: 'pink' },
  { start: '1962', end: '1968', label: 'Atlas', size: '11px', dodge: '40px', color: 'lightblue', align: 'left' },
]

// software companies — the original ran these to 'today' (viewed in 2021)
export const companies = [
  { start: 'April 4, 1975', end: END, color: 'blue', topLabel: 'Microsoft', dodge: '40px', size: '9px', opacity: '0.4' },
  { start: 'September 4, 1998', end: END, color: 'orange', topLabel: 'Google', dodge: '80px', size: '9px', opacity: '0.4' },
  { start: 'April 1, 1976', end: END, color: 'silver', topLabel: 'Apple', dodge: '0px', size: '9px', opacity: '0.4' },
]

// full-width marker + shaded mainframe-era region
export const engelbart = { date: 'December 1968', label: 'Engelbart demo', width: '50%', left: '15%' }
export const region = { start: '1936', end: 'December 1967', width: '6.5%', left: '36.5%' }
