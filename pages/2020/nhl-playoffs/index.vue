<script setup>
import { ref, computed } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import playoffs from './playoffs.json'
import teams from './teams.json'

definePageMeta({ title: 'NHL playoff appearances by time', description: 'playoff runs per team, 1968–2019' })

// tunables — same as the 2020 Post.svelte
const height = 900
const start = spacetime('jan 1 1965')
const end = spacetime('jan 1 2020')
const colWidth = 75 // px per playoff round
const barWidth = 70

const team = ref('Toronto')

// tiny scaleLinear ported from somehow-timeline: epoch → y px
const scale = (epoch) => parseInt(((epoch - start.epoch) / (end.epoch - start.epoch)) * height, 10)

// tick columns, ported from somehow-timeline Ticks.svelte ('2000' gets an underline)
const makeTicks = (every) =>
  start.minus(1, 'second').every(every, end).map((s) => {
    const label = String(s.format('year'))
    return { top: scale(s.epoch), label, century: /00$/.test(label) }
  })
const decadeTicks = makeTicks('decade')
const yearTicks = makeTicks('year')

// one bar-row per spring of each year
const years = []
for (let i = 1968; i <= 2019; i += 1) years.push(i)
const aprilTop = {}
years.forEach((y) => (aprilTop[y] = scale(spacetime('april 1 ' + y).epoch)))

// flat list of bars for the chosen team — 5th bar means they won the cup
const bars = computed(() =>
  years.flatMap((year) => {
    const n = playoffs[year][team.value] || 0
    return Array.from({ length: n }, (_, i) => ({
      top: aprilTop[year],
      left: i * colWidth,
      color: i === 4 ? colors.orange : colors.blue,
    }))
  })
)

// dotted guide-lines with round names
const roundLabels = [['1st', 'round'], ['2nd', 'round'], ['semi-final'], ['final'], ['winner']]
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1 class="mb-6">NHL playoff appearances by time</h1>

    <div class="bg-white rounded-xl shadow-md p-6">
      <!-- team picker -->
      <div class="row-left" style="width:600px">
        <select v-model="team" class="ml-16 border border-gray-200 rounded px-2 py-1 bg-white text-gray-700">
          <option v-for="t in teams" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <!-- timeline: decade ticks | year ticks | bars -->
      <div class="m-12 relative">
        <div class="timeline" :style="{ height: height + 'px' }">
          <!-- decade ticks -->
          <div class="column" style="min-width:25px; max-width:25px;">
            <div v-for="t in decadeTicks" :key="t.label" class="tick" :class="{ century: t.century }"
              :style="{ top: t.top + 'px', color: colors.grey, fontSize: '12px' }">{{ t.label }}</div>
          </div>
          <!-- year ticks -->
          <div class="column" style="min-width:25px; max-width:25px;">
            <div v-for="t in yearTicks" :key="t.label" class="tick" :class="{ century: t.century }"
              :style="{ top: t.top + 'px', color: colors.lightgrey, fontSize: '8px' }">{{ t.label }}</div>
          </div>
          <!-- playoff-run bars -->
          <div class="column" style="min-width:375px; max-width:375px;">
            <div v-for="(lab, i) in roundLabels" :key="i" class="line"
              :style="{ left: i * colWidth + 'px', borderRight: i === roundLabels.length - 1 ? 'none' : undefined }">
              <div v-for="ln in lab" :key="ln">{{ ln }}</div>
            </div>
            <div v-for="(b, i) in bars" :key="i" class="bar"
              :style="{ top: b.top + 'px', left: b.left + 'px', width: barWidth + 'px', backgroundColor: b.color }">
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://en.wikipedia.org/wiki/Stanley_Cup_playoffs">data from wikipedia</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
  width: 600px;
}

.column {
  position: relative;
  min-height: 100%;
  margin: 0 20px;
}

/* tick labels, absolute within their column */
.tick {
  position: absolute;
  padding-left: 4px;
  padding-right: 4px;
  white-space: nowrap;
  text-align: left;
  transform: translate(0px, -8px);
}

/* the year 2000 gets an underline, like the original */
.century {
  border-bottom: 1px solid grey;
}

/* dotted vertical guides labelled by playoff round */
.line {
  position: absolute;
  border-right: 1px dotted grey;
  min-height: 100%;
  width: 75px;
  top: 0px;
  color: grey;
  font-size: 10px;
  line-height: 100%;
}

/* one playoff round survived */
.bar {
  position: absolute;
  height: 5px;
  border-radius: 2px;
  opacity: 0.5;
}
</style>
