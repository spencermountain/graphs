<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import cities from './cities.js'
import leagues from './leagues.js'
import latitudes from './latitudes.js'

definePageMeta({
  title: 'north american sports seasons by city',
  description: 'nhl, mlb, nba, nfl + mls seasons through the year, cities sorted by latitude',
})

// -- somehow v0.0.8 chart geometry --
const W = 470 // height 200 at 'widescreen' (2.35) aspect
const H = 200
const rowGap = 10 // px between team rows, stacked up from the axis
const axisColor = colors.lighter // '#d7d5d2'

// the original applied its 2018 season dates to the current year
const year = ref(2026) // ssr fallback — refreshed on mount
const nowEpoch = ref(null)
onMounted(() => {
  year.value = new Date().getFullYear()
  nowEpoch.value = Date.now()
})

const jan1 = computed(() => spacetime('Jan 1 ' + year.value).epoch)
const dec31 = computed(() => spacetime('Dec 31 ' + year.value).epoch)

// date-in-year -> px, same truncating linear scale as somehow
const xEpoch = (e) => Math.trunc((W * (e - jan1.value)) / (dec31.value - jan1.value))
const xOf = (str) => xEpoch(spacetime(str + ' ' + year.value).epoch)

// 12 evenly-spaced ticks, Jan 1 -> Dec 31, labeled by month
const ticks = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const epoch = jan1.value + (i / 11) * (dec31.value - jan1.value)
    return { x: Math.trunc((W * i) / 11), label: spacetime(epoch).format('{month-short}') }
  })
)

// season segments per league: [from, to, isPlayoff] — playoffs draw dotted + faded
const segments = {
  nhl: (l) => [[l.start, 'Dec 31', false], ['Jan 1', l.end, false], [l.end, l.playoff, true]],
  mlb: (l) => [[l.start, l.end, false], [l.end, l.playoff, true]],
  nba: (l) => [[l.start, 'Dec 31', false], ['Jan 1', l.end, false], [l.end, l.playoff, true]],
  nfl: (l) => [[l.end, l.start, false], ['Jan 1', l.playoff, true]],
  mls: (l) => [[l.start, l.end, false], [l.end, l.playoff, true]],
}

// cities sorted north -> south
const chosen = Object.keys(cities).sort((a, b) => (latitudes[a] < latitudes[b] ? 1 : -1))

const charts = computed(() =>
  chosen.map((name) => {
    const city = cities[name]
    const rows = []
    let i = 1
    Object.keys(leagues).forEach((k) => {
      ;(city[k] || []).forEach((team) => {
        rows.push({
          team,
          color: leagues[k].color,
          y: H - i * rowGap, // season line
          labelY: H - i * rowGap - 2, // team label baseline
          legY: H - (i * rowGap + 6), // little color swatch beside the label
          lines: segments[k](leagues[k]).map(([a, b, playoff]) => ({ x1: xOf(a), x2: xOf(b), playoff })),
        })
        i += 1
      })
    })
    return { name, lat: latitudes[name], rows, todayTop: H - (i * rowGap + 25) }
  })
)

// dotted 'today' line — client-only, like the original's spacetime.now()
const todayX = computed(() => (nowEpoch.value === null ? null : xEpoch(nowEpoch.value)))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-semibold" :style="{ color: colors.brown }">north american sports seasons by city</h1>
      <div class="text-gray-400 text-sm">nhl, mlb, nba, nfl + mls seasons, cities sorted north to south</div>
    </div>

    <!-- one small chart per city -->
    <div class="bg-white rounded-xl shadow-md p-6 max-w-full overflow-x-auto">
      <div class="col w-[800px]">
        <svg v-for="c in charts" :key="c.name" :width="W" :height="H" :viewBox="`0,0,${W},${H}`"
          preserveAspectRatio="xMidYMid meet" class="chart">
          <!-- x axis + month ticks -->
          <line x1="0" :y1="H" :x2="W" :y2="H" :stroke="axisColor" stroke-width="1" />
          <text v-for="t in ticks" :key="t.x" :x="t.x" :y="H + 15" :fill="axisColor" text-anchor="middle"
            style="font-size:12px">{{ t.label }}</text>

          <!-- one row per team: season line(s), color swatch, label -->
          <g v-for="(r, ri) in c.rows" :key="ri">
            <line v-for="(l, li) in r.lines" :key="li" :x1="l.x1" :x2="l.x2" :y1="r.y" :y2="r.y" :stroke="r.color"
              stroke-width="4" stroke-linecap="round" :stroke-dasharray="l.playoff ? 5 : null"
              :opacity="l.playoff ? 0.4 : null" />
            <line x1="507" x2="512" :y1="r.legY" :y2="r.legY" :stroke="r.color" stroke-width="2"
              stroke-linecap="round" />
            <text x="519" :y="r.labelY" :fill="colors.lightgrey" style="font-size:10px">{{ r.team }}</text>
          </g>

          <!-- latitude + city name, hanging left of the chart -->
          <text x="-148" y="100.7" fill="grey" style="font-size:11px">{{ c.lat }}°</text>
          <text x="-123" y="99.2" fill="grey" style="font-size:16px">{{ c.name }}</text>

          <!-- today line -->
          <line v-if="todayX !== null" :x1="todayX" :x2="todayX" :y1="H" :y2="c.todayTop" :stroke="colors.lightgrey"
            stroke-width="1" stroke-dasharray="4" />
        </svg>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome/2018/01">source</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* labels hang outside each svg, like the original's overflow:visible */
.chart {
  overflow: visible;
  margin: 10px 20px 25px 25px;
}
</style>
