<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import missions from './missions.js'

definePageMeta({
  title: 'Lunar astronauts by age',
  description: 'apollo crews against an 81-year life expectancy',
})

// -- somehow v0.0.8 chart geometry --
const EXPECT = 81 // life expectancy, years
const W = 470 // height 200 at 'widescreen' (2.35) aspect
const H = 200
const xmin = spacetime('Jan 1 1925').epoch
const xmax = spacetime('Dec 31 2025').epoch

// truncating linear scales, same as somehow's mini scaleLinear
const x = (e) => Math.trunc((W * (e - xmin)) / (xmax - xmin))
const y = (v) => Math.trunc((H * (4 - v)) / 4) // y.fit(0, 4) — rows at 150/100/50

// 'today' — computed on mount, like the original's spacetime.now()
const nowEpoch = ref(null)
onMounted(() => { nowEpoch.value = Date.now() })
const todayX = computed(() => (nowEpoch.value === null ? null : x(nowEpoch.value)))

// one chart per mission: 3 crew rows + mission-date line
const charts = computed(() => {
  const now = nowEpoch.value === null ? null : spacetime(nowEpoch.value)
  return Object.keys(missions).map((name) => {
    const m = missions[name]
    const people = m.people.map((p, i) => {
      const rowY = y(i + 1)
      const born = spacetime(p.birth)
      const row = { name: p.name, rowY, x1: x(born.epoch), dead: Boolean(p.death) }
      if (p.death) {
        row.x2 = x(spacetime(p.death).epoch) // grey: birth → death
      } else {
        row.x2 = x(born.add(EXPECT, 'years').epoch) // blue: birth → 81yr mark
        row.age = now ? born.diff(now, 'years') + 'yr' : null
      }
      return row
    })
    return { name, dateX: x(spacetime(m.date).epoch), people }
  })
})

const x1969 = x(spacetime('Jan 1 1969').epoch)

// legend geometry: x.fit(-2, 10) over 500px, y = 50
const lx = (v) => Math.trunc((500 * (v + 2)) / 12)
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-semibold" :style="{ color: colors.brown }">Lunar astronauts by age</h1>
      <div class="text-gray-400 text-sm">apollo crews against an 81-year life expectancy</div>
    </div>

    <div class="bg-white rounded-xl shadow-md p-6 max-w-full overflow-x-auto">
      <div class="col w-[700px]">
        <!-- legend -->
        <svg width="500" height="100" viewBox="0,0,500,100" preserveAspectRatio="xMidYMid meet" class="chart">
          <line :x1="lx(1)" y1="50" :x2="lx(6)" y2="50" :stroke="colors.blue" stroke-width="4" stroke-linecap="round"
            opacity="0.6" />
          <line :x1="lx(6)" y1="50" :x2="lx(7)" y2="50" :stroke="colors.red" stroke-width="4" stroke-linecap="round"
            stroke-dasharray="4" opacity="0.6" />
          <g :transform="`translate(${lx(1) + 2} 23.5)`" style="font-size:11px">
            <text fill="grey"><tspan x="0" dy="1.2em">birth</tspan></text>
          </g>
          <g :transform="`translate(${lx(6) + 2} 23.5)`" style="font-size:11px">
            <text fill="grey" text-anchor="middle"><tspan x="0" dy="1.2em">life expectency</tspan></text>
          </g>
          <g :transform="`translate(${lx(6) + 2} 52)`" style="font-size:12px">
            <text fill="grey" text-anchor="middle"><tspan x="0" dy="1.2em">(81 years)</tspan></text>
          </g>
        </svg>

        <!-- one chart per mission -->
        <div v-for="c in charts" :key="c.name" class="m-8">
          <svg :width="W" :height="H" :viewBox="`0,0,${W},${H}`" preserveAspectRatio="xMidYMid meet" class="chart">
            <!-- x axis: 1925 → 2025 -->
            <line x1="0" :y1="H" :x2="W" :y2="H" :stroke="colors.lighter" stroke-width="1" />
            <text x="0" :y="H + 15" :fill="colors.lighter" text-anchor="middle" style="font-size:12px">1925</text>
            <text :x="x1969" :y="H + 15" :fill="colors.lighter" text-anchor="middle" style="font-size:12px">1969</text>
            <text v-if="todayX !== null" :x="todayX" :y="H + 15" :fill="colors.lighter" text-anchor="middle"
              style="font-size:12px">today</text>

            <!-- one row per crew member -->
            <g v-for="(p, pi) in c.people" :key="pi">
              <!-- life line: grey birth→death, or blue birth→life-expectancy -->
              <line :x1="p.x1" :x2="p.x2" :y1="p.rowY" :y2="p.rowY" :stroke="p.dead ? colors.lightgrey : colors.blue"
                stroke-width="4" stroke-linecap="round" />
              <!-- alive: red dotted span between the 81yr mark and today, + current age -->
              <template v-if="!p.dead && todayX !== null">
                <line :x1="todayX" :x2="p.x2" :y1="p.rowY" :y2="p.rowY" :stroke="colors.red" stroke-width="4"
                  stroke-linecap="round" stroke-dasharray="4" />
                <g :transform="`translate(${todayX + 12} ${p.rowY - 7})`" style="font-size:10px">
                  <text :fill="colors.lightgrey" text-anchor="start"><tspan x="0" dy="1.2em">{{ p.age }}</tspan></text>
                </g>
              </template>
              <!-- name, at birth date -->
              <g :transform="`translate(${p.x1 + 2} ${p.rowY - 26})`">
                <text fill="grey"><tspan x="0" dy="1.2em">{{ p.name }}</tspan></text>
              </g>
            </g>

            <!-- mission launch date -->
            <line :x1="c.dateX" :x2="c.dateX" y1="160" y2="40" :stroke="colors.orange" stroke-width="1"
              stroke-linecap="round" stroke-dasharray="4" />
            <!-- mission name, hanging left of the chart -->
            <g transform="translate(-98 60)">
              <text :fill="colors.lightgrey"><tspan x="0" dy="1.2em">{{ c.name }}</tspan></text>
            </g>
            <!-- today line -->
            <line v-if="todayX !== null" :x1="todayX" :x2="todayX" y1="180" y2="20" :stroke="colors.lightgrey"
              stroke-width="1" stroke-linecap="round" stroke-dasharray="4" />
          </svg>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome/2018/03">source</a>
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
