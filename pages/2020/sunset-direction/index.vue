<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import { sunPosition, getSunSet, getSunRise, calcYear, tz } from './sun.js'
import { arcPath, linePath, tick } from './circle.js'

definePageMeta({ title: 'Sunrise + Sunset direction', description: 'which way the sun rises and sets, through the year' })

// controls
const lat = ref(37) // latitude °N
const day = ref(null) // iso date — set on mount (ssr-safe)

// computed on change, like the original
const ticks = ref([]) // weekly {sunrise, sunset} azimuths for the year
const currentRise = ref(0)
const currentSet = ref(0)
const dateLabel = ref('')

const change = function () {
  if (!day.value) {
    return
  }
  let now = spacetime(day.value, tz)
  let set = getSunSet(now, lat.value)
  currentSet.value = sunPosition(set.epoch, lat.value).azimuth
  let rise = getSunRise(now, lat.value)
  currentRise.value = sunPosition(rise.epoch, lat.value).azimuth
  ticks.value = calcYear(lat.value)
  dateLabel.value = now.format('{month-short} {date-ordinal}')
}
onMounted(() => {
  day.value = spacetime.now(tz).format('iso-short')
  change()
})

// compass letters, using the same tick() math as azimuths
const compass = [
  { text: 'N', size: 2.6, ...tick({ angle: 180, radius: 45, rotate: 0 }) },
  { text: 'S', size: 2.6, ...tick({ angle: 0, radius: 45, rotate: 0 }) },
  { text: 'W', size: 2.6, ...tick({ angle: 90, radius: 45 }) },
  { text: 'E', size: 2.6, ...tick({ angle: 270, radius: 45 }) },
]

// date labels on three weeks (~mid-march, late june, late december)
const dateLabels = computed(() =>
  [10, 24, 50]
    .filter((i) => ticks.value[i])
    .flatMap((i) => {
      let week = ticks.value[i]
      let align = i === 24 ? 'left' : 'right'
      return [
        { key: i + '-set', text: week.date, ...tick({ angle: week.sunset, radius: 62, align }) },
        { key: i + '-rise', text: week.date, ...tick({ angle: week.sunrise, radius: 69, align }) },
      ]
    })
)
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1 class="text-2xl text-gray-700 mt-2">Sunrise + Sunset direction</h1>
    <div class="text-gray-400 mb-6">at {{ lat }}°</div>

    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-2xl col-center">
      <!-- controls -->
      <div class="row-center gap-4 mb-2">
        <input type="range" min="4" max="74" v-model.number="lat" @change="change" />
        <input type="date" v-model="day" @change="change" class="text-gray-500" />
      </div>

      <!-- the compass chart -->
      <svg v-if="day" viewBox="-50 -50 100 100" class="w-full max-w-[540px] overflow-visible" shape-rendering="geometricPrecision">
        <!-- compass letters -->
        <text v-for="c in compass" :key="c.text" :x="c.x" :y="c.y" :transform="`rotate(${c.angle},${c.x},${c.y})`"
          :font-size="c.size" :text-anchor="c.anchor" fill="lightblue">{{ c.text }}</text>

        <!-- weekly sunset (pink) + sunrise (yellow) ticks -->
        <template v-for="week in ticks" :key="week.id">
          <path :d="arcPath({ from: week.sunset, to: week.sunset + 0.5, radius: 52, width: 8 })" :fill="colors.pink" stroke="none" />
          <path :d="arcPath({ from: week.sunrise, to: week.sunrise + 0.5, radius: 52, width: 8 })" :fill="colors.yellow" stroke="none" />
        </template>

        <!-- date labels -->
        <text v-for="lb in dateLabels" :key="lb.key" :x="lb.x" :y="lb.y" :transform="`rotate(${lb.angle},${lb.x},${lb.y})`"
          font-size="1.5" :text-anchor="lb.anchor" :fill="colors.light">{{ lb.text }}</text>

        <!-- today's sunrise → sunset -->
        <path :d="linePath({ angle: currentSet, radius: 5, length: 40 })" stroke="lightblue" fill="lightblue" stroke-width="0.2" />
        <path :d="linePath({ angle: currentRise, radius: 5, length: 40 })" stroke="lightblue" fill="lightblue" stroke-width="0.2" />
        <path :d="arcPath({ from: currentRise, to: currentSet, radius: 15, width: 6 })" fill="lightblue" stroke="none" />
      </svg>

      <div style="color: grey">{{ dateLabel }}</div>
    </div>

    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* same hover affordance as the original somehow-circle */
path {
  pointer-events: all;
}

path:hover {
  filter: drop-shadow(0px 1px 1px steelblue);
}
</style>
