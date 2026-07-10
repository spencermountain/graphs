<script setup>
import { ref, computed, onMounted } from 'vue'
import colors from '~/assets/colors.js'
import latitudes from './by-latitude.js'
import labels from './labels.js'
import monotoneX from './monotoneX.js'

definePageMeta({
  title: 'temperatures by latitude',
  description: 'monthly average temperature in the biggest city at each latitude',
})

// -- config (matches the 2018 somehow-chart) --
const H = 250 // chart height
const W = 588 // 'widescreen' 2.35:1 aspect of 250
const MIN_LAT = -55
const MAX_LAT = 55
const SLIDER_SIZE = 200 // slider track px

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// somehow used truncating integer scales
const yScale = (v) => Math.trunc((H * (40 - v)) / 80) // y.fit(-40, 40), flipped

// today + year computed on mount, to keep prerender SSR-safe
const year = ref(null)
const todayEpoch = ref(null)
onMounted(() => {
  year.value = new Date().getFullYear()
  todayEpoch.value = Date.now()
})

const jan1 = computed(() => new Date(year.value, 0, 1).getTime())
const dec31 = computed(() => new Date(year.value, 11, 31).getTime())
const xScale = (epoch) => Math.trunc((W * (epoch - jan1.value)) / (dec31.value - jan1.value))

// slider state: pick the nearest latitude that has a city
const lat = ref(37)
const findClosest = (num) => {
  num = parseInt(num, 10)
  for (let i = 0; i < 50; i += 1) {
    if (latitudes[String(num + i)]) return latitudes[String(num + i)]
    if (latitudes[String(num - i)]) return latitudes[String(num - i)]
  }
  return null
}
const city = computed(() => findClosest(lat.value))

// month-firsts, plus January's value repeated on Dec 31 to close the year
const cityPoints = computed(() => {
  const temps = city.value.weather.split(',').map(Number)
  const pts = temps.map((t, i) => [xScale(new Date(year.value, i, 1).getTime()), yScale(t)])
  pts.push([xScale(dec31.value), yScale(temps[0])])
  return pts
})
const cityPath = computed(() => monotoneX(cityPoints.value))

// city name floats above the July 1st point (dx -12, dy 7 in the original)
const labelPos = computed(() => {
  const p = cityPoints.value[6]
  return { x: p[0] - 10, y: p[1] - 31 }
})

// 6 evenly-spaced x ticks across the year, labelled by month
const xTicks = computed(() => {
  const out = []
  for (let i = 0; i <= 5; i += 1) {
    const epoch = jan1.value + (i / 5) * (dec31.value - jan1.value)
    out.push({ x: xScale(epoch), label: months[new Date(epoch).getMonth()] })
  }
  return out
})

// fixed °C ticks, as given to yAxis.ticks()
const yTicks = [
  { v: -30, label: '-30°' },
  { v: -15, label: '-15°' },
  { v: 0, label: '0 °' },
  { v: 15, label: '15°' },
  { v: 30, label: '30°' },
].map((t) => ({ y: yScale(t.v), label: t.label }))

// grey city markers beside the vertical slider track
const sliderLabels = labels.map(([name, deg]) => ({
  label: `${deg}° ${name}`,
  y: ((deg - MIN_LAT) / (MAX_LAT - MIN_LAT)) * SLIDER_SIZE,
}))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1>temperatures by latitude</h1>
      <div class="ml-4 text-gray-400">monthly average temperature in the biggest city at each latitude</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6">
      <div class="row-center">
        <svg :width="W" :height="H" :viewBox="`0,0,${W},${H}`" preserveAspectRatio="xMidYMid meet"
          style="overflow: visible; margin: 10px 20px 25px 25px">
          <!-- x axis -->
          <g v-if="year">
            <text v-for="t in xTicks" :key="t.label" :x="t.x" :y="H + 15" fill="#d7d5d2" text-anchor="middle"
              style="font-size: 12px">{{ t.label }}</text>
          </g>
          <line x1="0" :y1="H" :x2="W" :y2="H" stroke="#d7d5d2" stroke-width="1" />
          <!-- y axis -->
          <g>
            <text v-for="t in yTicks" :key="t.label" x="0" :y="t.y" dx="-6" dy="0" fill="#d7d5d2" text-anchor="end"
              style="font-size: 12px">{{ t.label }}</text>
            <line x1="0" y1="0" x2="0" :y2="H" stroke="#d7d5d2" stroke-width="1" />
          </g>
          <!-- today marker, spanning 20%-80% -->
          <path v-if="todayEpoch" :d="`M${xScale(todayEpoch)},${yScale(-24)}L${xScale(todayEpoch)},${yScale(24)}`"
            fill="none" :stroke="colors.lighter" stroke-width="1" stroke-linecap="round" />
          <!-- dashed 0° mid-line -->
          <path :d="`M0,${yScale(0)}L${W},${yScale(0)}`" fill="none" :stroke="colors.lightgrey" stroke-width="1"
            stroke-dasharray="4" stroke-linecap="round" />
          <!-- the city's temperature curve + name -->
          <g v-if="year && city">
            <path :d="cityPath" fill="none" :stroke="colors.blue" stroke-width="4" stroke-linecap="round" />
            <g :transform="`translate(${labelPos.x} ${labelPos.y})`">
              <text :fill="colors.blue">
                <tspan x="0" dy="1.2em">{{ city.city }}</tspan>
              </text>
            </g>
          </g>
        </svg>

        <!-- vertical latitude slider -->
        <div class="ml-12" :style="{ position: 'relative', height: SLIDER_SIZE + 'px', width: '100px' }">
          <div :style="{ position: 'absolute', top: '-20px', left: '-20px', color: colors.lightgrey, fontSize: '14px' }">
            Latitude:</div>
          <div v-for="l in sliderLabels" :key="l.label" class="whitespace-nowrap"
            :style="{ position: 'absolute', top: l.y + 'px', left: '10px', color: colors.lightgrey, fontSize: '10px' }">
            {{ l.label }}</div>
          <input type="range" :min="MIN_LAT" :max="MAX_LAT" step="1" v-model.number="lat"
            :style="{ transform: 'rotate(90deg)', width: SLIDER_SIZE + 'px', transformOrigin: '0% 0%', margin: 0 }" />
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome/2018/02">source</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>
