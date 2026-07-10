<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'

definePageMeta({ title: 'Generations of people', description: 'your family line, walking back through history' })

// -- tunables (from the 2019 original) --
const W = 800 // svg width
const rowH = 15 // px per generation row
const baseH = 200 // minimum chart height
const mGenLength = 25 // years per paternal generation
const fGenLength = 20 // ..maternal
const yearMs = 365.25 * 24 * 60 * 60 * 1000

const mNames = ['you', 'father', 'grandfather']
const fNames = ['you', 'mother', 'grandmother']

const wars = [
  { label: 'WWII', start: 'Sep 1 1939', end: 'Sep 2 1945', mid: 'Sep 1 1941' },
  { label: 'WWI', start: 'Jul 28 1914', end: 'Nov 11 1918', mid: 'Sep 1 1916' },
]
const events = [
  { date: 'Dec 5 1492', lines: ['columbus', 'landing'] },
  { date: 'Dec 5 1206', lines: ['Genghis', 'Khan'] },
]

// controls
const age = ref(33)
const gens = ref(10)
const gender = ref('paternal')

// 'now' on the client only (page is prerendered)
const now = ref(null)
onMounted(() => (now.value = spacetime.now()))

const toOrdinal = (i) => {
  const j = i % 10
  const k = i % 100
  if (j === 1 && k !== 11) return i + 'st'
  if (j === 2 && k !== 12) return i + 'nd'
  if (j === 3 && k !== 13) return i + 'rd'
  return i + 'th'
}

// linear life-expectancy model: 40yrs in 1900 → 77 today
const lifespan = (year, nowYear) => {
  if (year < 1900) return 40
  return 40 + (year - 1900) * (37 / (nowYear - 1900))
}

// x-axis ticks, ported from spacetime-ticks (spans here are always >30yrs → decade or century steps)
const makeTicks = (xMin, xMax) => {
  const startYear = spacetime(xMin).year()
  const step = spacetime(xMax).year() - startYear > 300 ? 100 : 10
  let arr = []
  for (let yr = Math.floor((startYear + step) / step) * step; ; yr += step) {
    const e = spacetime([yr, 0, 1]).epoch
    if (e >= xMax) break
    arr.push({ yr, e })
  }
  while (arr.length > 6) arr = arr.filter((_, i) => i % 2 === 0) // reduceTo n=6
  return arr
}

const chart = computed(() => {
  if (!now.value) return null
  const nowS = now.value
  const maternal = gender.value === 'maternal'
  const names = maternal ? fNames : mNames
  const genLength = maternal ? fGenLength : mGenLength
  const H = Math.max(baseH, gens.value * rowH)

  // one lifeline per generation, walking back in time
  let d = nowS.minus(age.value, 'years')
  const people = []
  for (let i = 0; i < gens.value; i += 1) {
    const life = lifespan(d.year(), nowS.year()) + (maternal ? 4 : 0) // women get +4yrs
    const end = Math.min(d.epoch + life * yearMs, nowS.epoch)
    people.push({ start: d.epoch, end, name: names[i] || toOrdinal(i) + ' gen' })
    d = d.minus(genLength, 'years')
  }

  const xMin = Math.min(...people.map((p) => p.start))
  const xMax = Math.max(...people.map((p) => p.end))
  const x = (e) => ((e - xMin) / (xMax - xMin)) * W
  const rowY = (i) => ((gens.value - 1 - i) / (gens.value - 1)) * H // you=bottom, ancestors upward
  const inRange = (e) => e >= xMin && e <= xMax

  // dotted line at each century
  const centuries = []
  for (let c = 900; c < nowS.year(); c += 100) {
    const e = spacetime([c, 0, 1]).epoch
    if (inRange(e)) centuries.push(x(e))
  }

  return {
    H,
    color: maternal ? colors.purple : colors.blue,
    rows: people.map((p, i) => ({ x1: x(p.start), x2: x(p.end), y: rowY(i), name: p.name })),
    ticks: makeTicks(xMin, xMax).map((t) => ({ label: String(t.yr), x: x(t.e) })),
    // translucent red bands, kept if they overlap the range at all
    wars: wars
      .map((w) => ({ ...w, a: spacetime(w.start).epoch, b: spacetime(w.end).epoch, m: spacetime(w.mid).epoch }))
      .filter((w) => w.a <= xMax && w.b >= xMin)
      .map((w) => ({ label: w.label, x: x(w.a), width: x(w.b) - x(w.a), midX: x(w.m), showLabel: inRange(w.m) })),
    centuries,
    // two-line labels for far-back events
    events: events
      .filter((ev) => inRange(spacetime(ev.date).epoch))
      .map((ev) => ({ x: x(spacetime(ev.date).epoch), lines: ev.lines })),
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="m-0 mt-2">Generations of people</h1>
      <div class="text-gray-400 mt-1">your family line, walking back through history</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6 w-full max-w-4xl">
      <!-- controls -->
      <div class="row gap-8 mb-2">
        <div class="col-left flex-1">
          <div class="text-sm" :style="{ color: colors.grey }">your age:</div>
          <input type="range" min="1" max="120" step="1" v-model.number="age" class="w-full" />
          <div class="text-sm" :style="{ color: colors.grey }">{{ age }}</div>
        </div>
        <div class="col-left">
          <div class="text-sm" :style="{ color: colors.grey }">line:</div>
          <select v-model="gender" class="border border-gray-200 rounded px-2 py-1 bg-white text-gray-700">
            <option>paternal</option>
            <option>maternal</option>
          </select>
        </div>
        <div class="col-left flex-1">
          <div class="text-sm" :style="{ color: colors.grey }">generations:</div>
          <input type="range" min="3" max="40" step="1" v-model.number="gens" class="w-full" />
          <div class="text-sm" :style="{ color: colors.grey }">{{ gens }}</div>
        </div>
      </div>

      <!-- chart (client-only: depends on today's date) -->
      <div v-if="chart" class="overflow-x-auto">
        <svg :width="W" :height="chart.H + 40" :viewBox="`0 0 ${W} ${chart.H + 40}`"
          style="overflow: visible; margin: 10px 20px 25px 25px">
          <!-- x axis + year ticks -->
          <line x1="0" :y1="chart.H" :x2="W" :y2="chart.H" :stroke="colors.lighter" stroke-width="1" />
          <text v-for="t in chart.ticks" :key="t.x" :x="t.x" :y="chart.H + 15" :fill="colors.lighter"
            text-anchor="middle" font-size="12">{{ t.label }}</text>

          <!-- one lifeline per generation -->
          <g v-for="r in chart.rows" :key="r.name">
            <path :d="`M${r.x1},${r.y} L${r.x2},${r.y}`" fill="none" :stroke="chart.color" stroke-width="4"
              stroke-linecap="round" />
            <text :x="r.x1 + 7" :y="r.y - 4.7" fill="grey" font-size="9">{{ r.name }}</text>
          </g>

          <!-- world wars -->
          <g v-for="w in chart.wars" :key="w.label">
            <rect :x="w.x" y="0" :width="w.width" :height="chart.H" rx="1" :fill="colors.red" :stroke="colors.red"
              fill-opacity="0.25" stroke-width="1" />
            <text v-if="w.showLabel" :x="w.midX + 2" :y="chart.H + 30.4" fill="grey" text-anchor="middle"
              font-size="12">{{ w.label }}</text>
          </g>

          <!-- century gridlines -->
          <path v-for="cx in chart.centuries" :key="cx" :d="`M${cx},${chart.H} L${cx},0`" fill="none"
            :stroke="colors.grey" stroke-width="1" stroke-dasharray="4" stroke-linecap="round" />

          <!-- far-back event labels -->
          <text v-for="ev in chart.events" :key="ev.x" text-anchor="middle" fill="grey" font-size="12">
            <tspan v-for="(l, i) in ev.lines" :key="i" :x="ev.x + 2" :y="chart.H - 32.6 + i * 14.4">{{ l }}</tspan>
          </text>
        </svg>
      </div>
      <!-- hold the space before mount -->
      <div v-else :style="{ height: Math.max(baseH, gens * rowH) + 75 + 'px' }"></div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome">source</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>
