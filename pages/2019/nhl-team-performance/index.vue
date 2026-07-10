<script setup>
import { ref, computed } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import divisions from './data/divisions.js'
import teamColors from './teamColors.js'
import { linear, monotonePath } from './chart.js'
import year2014 from './data/year-2014.js'
import year2015 from './data/year-2015.js'
import year2016 from './data/year-2016.js'
import year2017 from './data/year-2017.js'
import year2018 from './data/year-2018.js'

definePageMeta({ title: 'NHL seasons by team', description: 'wins above a .500 record, through each season' })

// chart size (from the original somehow world)
const W = 800
const H = 200

const byYear = {
  '2014-15': year2014,
  '2015-16': year2015,
  '2016-17': year2016,
  '2017-18': year2017,
  '2018-19': year2018,
}
const yearOptions = Object.keys(byYear)
const year = ref('2018-19')

const divisionList = [
  ['atlantic', 'Atlantic'],
  ['metro', 'Metro'],
  ['central', 'Central'],
  ['pacific', 'Pacific'],
]

// y ticks: -20..20 in 6 steps, top of chart is +20
const yTicks = [0, 1, 2, 3, 4, 5].map((i) => ({
  y: (1 - i / 5) * H,
  label: String((i / 5) * 40 - 20),
}))

const charts = computed(() => {
  const data = byYear[year.value]
  const y0 = parseInt(year.value.replace(/-.*/, ''), 10)
  const min = spacetime(`Oct 1 ${y0}`).epoch
  const max = spacetime(`April 20 ${y0 + 1}`).epoch
  const x = linear([0, W], [min, max]) // date → px
  const y = linear([0, H], [20, -20]) // +/- → px (flipped)

  // month ticks — 1st of each month in range (port of spacetime-ticks)
  const xTicks = []
  const end = spacetime(max)
  let s = spacetime(min).add(1, 'month').startOf('month')
  while (s.isBefore(end)) {
    const pct = Math.trunc(((s.epoch - min) / (max - min)) * 1000) / 1000
    xTicks.push({ x: pct * W, label: s.format('{month-short} {year}') })
    s = s.add(1, 'month')
  }

  // one line + end-label per team, grouped by division
  const divs = divisionList.map(([key, name]) => {
    const teams = []
    for (const team of divisions[key]) {
      const games = ((data[team] || {}).games || []).filter((g) => g[1] !== null)
      if (!games.length) continue
      const pts = games.map((g) => [x(spacetime(g[0]).epoch), y(g[1])])
      const [lx, ly] = pts[pts.length - 1]
      teams.push({ team, color: teamColors[team] || colors.blue, d: monotonePath(pts), lx: lx + 2, ly: ly + 1 })
    }
    return { key, name, teams }
  })
  return { xTicks, divs }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold" :style="{ color: colors.brown }">NHL seasons by team</h1>
      <div class="text-sm text-gray-400">wins above a .500 record, through each season</div>
    </div>

    <!-- card -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl">
      <!-- year select -->
      <div class="col-left mb-6">
        <div class="text-sm" :style="{ color: colors.grey }">year:</div>
        <select v-model="year" class="border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 text-center cursor-pointer" style="min-width: 10rem">
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>

      <!-- one chart per division; viewBox padded for the labels that hang off each side -->
      <div v-for="d in charts.divs" :key="d.key" class="mb-2">
        <svg class="w-full" viewBox="-85 -10 995 230" preserveAspectRatio="xMidYMid meet">
          <!-- x axis + month ticks -->
          <text v-for="t in charts.xTicks" :key="t.label" :x="t.x" :y="H + 15" :fill="colors.lighter" text-anchor="middle" style="font-size: 12px">{{ t.label }}</text>
          <line x1="0" :y1="H" :x2="W" :y2="H" :stroke="colors.lighter" stroke-width="1" />
          <!-- y axis + ticks -->
          <text v-for="t in yTicks" :key="t.label" x="0" :y="t.y" dx="-6" dy="0" :fill="colors.lighter" text-anchor="end" style="font-size: 12px">{{ t.label }}</text>
          <line x1="0" y1="0" x2="0" :y2="H" :stroke="colors.lighter" stroke-width="1" />
          <!-- team lines, named at their last game -->
          <g v-for="t in d.teams" :key="t.team">
            <path :d="t.d" fill="none" :stroke="t.color" stroke-width="2" stroke-linecap="round" shape-rendering="optimizeQuality" />
            <text :x="t.lx" :y="t.ly" :fill="t.color" style="font-size: 10px">{{ t.team }}</text>
          </g>
          <!-- division name, hanging left of the y-axis -->
          <text x="-78" y="99.2" :fill="colors.olive" style="font-size: 16px">{{ d.name }}:</text>
          <!-- dotted .500 line -->
          <line x1="0" y1="100" :x2="W" y2="100" :stroke="colors.lightgrey" stroke-width="1" stroke-dasharray="4" stroke-linecap="round" />
        </svg>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome">source</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>
