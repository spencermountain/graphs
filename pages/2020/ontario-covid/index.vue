<script setup>
import colors from '~/assets/colors.js'
import { epoch, scaleLinear, numTicks, monthTicks } from './somehow.js'

definePageMeta({ title: 'Causes of death in Ontario', description: 'over the next 2 years' })

// == data ==
// deaths expected over the 2 years — 2x annual Ontario rates (38% of Canada), from the original:
// cancer 30k/yr, heart 20k/yr, accidents 5k/yr, diabetes 2.6k/yr, suicide 1.55k/yr, homicide 152/yr
const deaths = { cancer: 60000, heart: 40000, accidents: 10000, diabetes: 5000, suicide: 3000, homicide: 300 }
const drawn = ['cancer', 'heart', 'accidents', 'suicide'] // the ones the original charts

// == config ==
const start = 'Jan 1 2020'
const end = 'April 1 2022'
const yMax = 100000
const W = 100 // viewBox: somehow's 'widescreen' aspect resolved to 2.35:1 -> 100 x 43
const H = 43

// scales (viewBox units)
const xScale = scaleLinear({ world: [0, W], minmax: [epoch(start), epoch(end)] })
const x = (str) => xScale(epoch(str))
const y = scaleLinear({ world: [0, H], minmax: [yMax, 0] })

// axis ticks: Jan 2020 / Sep 2020 / May 2021 / Jan 2022, and 1k / 33k / 65k / 97k
const xTicks = monthTicks(start, end).map((t) => ({ label: t.label, x: Math.round(t.value * 1000) / 10 + '%' }))
const yTicks = numTicks(0, yMax).map((t) => ({ label: t.label, y: Math.round(1000 - t.value * 1000) / 10 + '%' }))

// somehow's Text placement: translated 2 right of the point, dodged up by est. text height
const label = (lines, px, py, { fill, size = 2, anchor = 'start', dx = 0, dy = 4, bold = false } = {}) =>
  ({ lines, fill, size, anchor, bold, x: px + 2 + dx, y: py + dy - size * 1.5 * lines.length - 2 })

// dotted marker lines, drawn under the projection band
const backLines = [
  { d: `M${x('jan 1 2021')},${y(0)} L${x('jan 1 2021')},${y(80000)}`, stroke: colors.lighter, dash: 10 },
  { d: `M${x('jan 1 2022')},${y(0)} L${x('jan 1 2022')},${y(80000)}`, stroke: colors.lighter, dash: 10 },
  { d: `M${x('March 22 2020')},${y(0)} L${x(end)},${y(100000)}`, stroke: colors.sea, dash: 10 }, // no-quarantine
]

// cause-of-death diagonals, drawn over the band
const causeLines = drawn.map((name) => ({
  d: `M${x(start)},${y(0)} L${x(end)},${y(deaths[name])}`, stroke: colors.light, dash: 4,
}))

// covid projection band: top edge 0 -> 15k, bottom edge 0 -> 3k
const band = `M${x('March 22 2020')},${y(0)} L${x(end)},${y(15000)} L${x(end)},${y(3000)} L${x('March 22 2020')},${y(0)} Z`

// text labels
const dodgeY = { accidents: 3.2, suicide: 6 } // original per-label nudges
const texts = [
  label(['new years'], x('jan 1 2021'), y(80000), { fill: colors.lighter, anchor: 'middle', dy: 1, dx: -2 }),
  label(['covid', 'no quarantine', '(100k)'], x(end), y(100000), { fill: colors.sea }),
  label(['covid projection', '(3k - 15k)'], x('sept 1 2021'), y(15000), { fill: colors.purple, size: 3, anchor: 'middle', bold: true, dy: 2, dx: 3 }),
  ...drawn.map((name) =>
    label([name, `(${deaths[name] / 1000}k)`], x(end), y(deaths[name]), { fill: colors.light, dy: dodgeY[name] || 4 })),
]
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl mt-1" :style="{ color: colors.blue }">Causes of death in Ontario</h1>
      <div class="text-gray-400">over the next 2 years</div>
    </div>

    <!-- chart card -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-3xl">
      <!-- right margin leaves room for the overflowing line-labels, as the original -->
      <div style="max-width: 600px; margin-right: 10%">
        <svg :viewBox="`0,0,${W},${H}`" preserveAspectRatio="xMidYMid meet" class="w-full"
          style="overflow: visible; margin: 10px 20px 25px 25px">
          <!-- x axis -->
          <g>
            <text v-for="t in xTicks" :key="t.label" :x="t.x" :y="H + 3" :fill="colors.lighter" text-anchor="middle"
              class="legible">{{ t.label }}</text>
            <line x1="0" :y1="H" :x2="W" :y2="H" :stroke="colors.lighter" stroke-width="1"
              vector-effect="non-scaling-stroke" />
          </g>
          <!-- y axis -->
          <g>
            <text v-for="t in yTicks" :key="t.label" x="0" :y="t.y" dx="-2" :fill="colors.lighter" text-anchor="end"
              class="legible">{{ t.label }}</text>
            <line x1="0" y1="0" x2="0" :y2="H" :stroke="colors.lighter" stroke-width="1"
              vector-effect="non-scaling-stroke" />
          </g>
          <!-- new-years + no-quarantine dotted lines -->
          <path v-for="(l, i) in backLines" :key="'b' + i" :d="l.d" fill="none" :stroke="l.stroke" stroke-width="1"
            :stroke-dasharray="l.dash" stroke-linecap="round" vector-effect="non-scaling-stroke"
            shape-rendering="optimizeQuality" />
          <!-- covid projection band: outline + translucent fill -->
          <path :d="band" fill="none" :stroke="colors.purple" stroke-width="2" vector-effect="non-scaling-stroke"
            shape-rendering="optimizeQuality" />
          <path :d="band" :fill="colors.purple" fill-opacity="0.25" stroke="none"
            shape-rendering="optimizeQuality" />
          <!-- cause-of-death diagonals -->
          <path v-for="(l, i) in causeLines" :key="'c' + i" :d="l.d" fill="none" :stroke="l.stroke" stroke-width="1"
            :stroke-dasharray="l.dash" stroke-linecap="round" vector-effect="non-scaling-stroke"
            shape-rendering="optimizeQuality" />
          <!-- labels -->
          <g v-for="(t, i) in texts" :key="'t' + i" :transform="`translate(${t.x} ${t.y})`">
            <text :fill="t.fill" :text-anchor="t.anchor"
              :style="{ fontSize: t.size + 'px', fontWeight: t.bold ? 520 : 400 }">
              <tspan v-for="(ln, j) in t.lines" :key="j" x="0" dy="1.2em">{{ ln }}</tspan>
            </text>
          </g>
        </svg>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <span>from Apr 3rd 2020
        <a class="link"
          href="http://s3.documentcloud.org/documents/6824779/COVID-19-Technical-Briefing-Friday-April-4-2020.pdf">projection
          by Public Health Ontario</a>
      </span>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* somehow-graph's responsive axis-tick sizing */
.legible {
  font-size: 2px;
}

@media (max-width: 600px) {
  .legible {
    font-size: 4px;
  }
}
</style>
