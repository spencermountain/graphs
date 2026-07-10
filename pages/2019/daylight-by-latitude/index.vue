<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import cities from './cities.js'
import { weekly, monthly, equinoxes, solstices, arcs } from './daylight.js'

definePageMeta({ title: 'sunlight by latitude', description: 'hours of sunlight through the year, at each latitude' })

// -- tunables --
const W = 100
const H = 43 // somehow's 'widescreen' aspect ratio
const R = 48.08 // circle radius, after somehow-circle's fit (50 * 50/52)
const yTicks = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23] // somehow-ticks output for 0-24hrs
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const lat = ref(43)
const year = ref(null) // set on mount, ssr-safe
onMounted(() => (year.value = new Date().getFullYear()))

// nearest known city on this latitude
const city = computed(() => {
  for (let i = 0; i < 60; i++) {
    if (cities[lat.value + i]) return cities[lat.value + i].city
    if (cities[lat.value - i]) return cities[lat.value - i].city
  }
  return ''
})

// hours of daylight at the start of each week
const weeks = computed(() => weekly(year.value, lat.value))

// x: epoch → 0-100, y: hours → H-0
const xPix = (epoch) => {
  let a = weeks.value[0].epoch
  let b = weeks.value[52].epoch
  return ((epoch - a) / (b - a)) * W
}
const yPix = (hours) => ((24 - hours) / 24) * H

const jan = computed(() => weeks.value[0].hours) // day-length at new-years
const midsummer = computed(() => weeks.value[26].hours) // ..at midsummer
const juneX = computed(() => xPix(spacetime([year.value, 5, 21]).epoch))

const rnd = (n) => Math.round(n * 100) / 100
// d3's curveBasis, as a path string
const basis = function (pts) {
  let n = pts.length
  if (n < 3) return 'M' + pts.map((p) => p.join(',')).join('L')
  let [x0, y0] = pts[0]
  let [x1, y1] = pts[1]
  let d = `M${rnd(x0)},${rnd(y0)}L${rnd((5 * x0 + x1) / 6)},${rnd((5 * y0 + y1) / 6)}`
  const bez = (x, y) =>
    `C${rnd((2 * x0 + x1) / 3)},${rnd((2 * y0 + y1) / 3)},${rnd((x0 + 2 * x1) / 3)},${rnd(
      (y0 + 2 * y1) / 3
    )},${rnd((x0 + 4 * x1 + x) / 6)},${rnd((y0 + 4 * y1 + y) / 6)}`
  for (let i = 2; i < n; i++) {
    d += bez(pts[i][0], pts[i][1])
    x0 = x1
    y0 = y1
    x1 = pts[i][0]
    y1 = pts[i][1]
  }
  d += bez(x1, y1) + `L${rnd(x1)},${rnd(y1)}`
  return d
}

const chartPts = computed(() => weeks.value.map((o) => [xPix(o.epoch), yPix(o.hours)]))
const linePath = computed(() => basis(chartPts.value))
const areaPath = computed(() => {
  let pts = chartPts.value
  return basis(pts) + `L${rnd(pts[pts.length - 1][0])},${H}L${rnd(pts[0][0])},${H}Z`
})

// summer/winter difference label
const hrDiff = computed(() => {
  let sol = solstices(year.value, lat.value)
  return Math.abs(Number((sol.summer - sol.winter).toFixed(1))) + 'hr diff'
})

// the day-circle: % of day → clockwise angle from midnight (svg is rotated 180°, so noon is up)
const arcPath = function (fromPct, toPct) {
  const pt = (pct) => {
    let a = (pct / 100) * 2 * Math.PI
    return `${rnd(R * Math.sin(a))},${rnd(-R * Math.cos(a))}`
  }
  let large = ((toPct - fromPct) / 100) * 2 * Math.PI > Math.PI ? 1 : 0
  return `M${pt(fromPct)} A${R},${R} 0 ${large} 1 ${pt(toPct)}`
}
const circleArcs = computed(() => {
  let a = arcs(year.value, lat.value)
  let summer = { d: arcPath(a.summer.from, a.summer.to), stroke: 'lightblue', dash: '1' } // css lightblue, like original
  let winter = { d: arcPath(a.winter.from, a.winter.to), stroke: colors.blue, dash: null }
  return lat.value < -24 ? [winter, summer] : [summer, winter] // southern hemisphere: swap draw-order
})

// '+H:MM' / '-H:MM' change per month
const fmtChange = function (a) {
  let str = String(Math.abs(a.hours || 0))
  if (a.minutes !== 0) {
    str += ':' + String(Math.abs(a.minutes)).padStart(2, '0')
  }
  return (a.hours < 0 || a.minutes < 0 ? '-' : '+') + str
}
const monthDiffs = computed(() => monthly(year.value, lat.value).map(fmtChange))

const eq = computed(() => equinoxes(year.value, lat.value))
const signed = (n) => (n > 0 ? '+' + n : String(n))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start ml-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1>sunlight by latitude</h1>
      <div class="ml-4 text-gray-400">hours of sunlight through the year</div>
    </div>

    <div class="bg-white rounded-xl shadow-md p-6 mt-6 w-full max-w-4xl">
      <template v-if="year">
        <!-- day-circle + latitude slider -->
        <div class="row-center w-full my-4 gap-12">
          <div class="relative" style="width: 17rem">
            <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid meet" class="w-full">
              <g transform="rotate(180)">
                <circle cx="0" cy="0" :r="R" stroke="lightgrey" stroke-width="0.2" fill="none" />
                <path v-for="(a, i) in circleArcs" :key="i" :d="a.d" :stroke="a.stroke" stroke-width="2" fill="none"
                  :stroke-dasharray="a.dash" />
              </g>
            </svg>
            <!-- city name, over the circle -->
            <div class="absolute inset-0 row-center pointer-events-none">
              <div class="text-center leading-tight" :style="{ color: colors.blue, fontSize: '2rem' }">{{ city }}</div>
            </div>
          </div>
          <div class="col" :style="{ color: colors.grey }">
            <div>latitude:</div>
            <input type="range" class="vslider my-2" min="-60" max="60" step="1" v-model.number="lat" />
            <div>{{ lat }}</div>
          </div>
        </div>

        <!-- daylight hours through the year -->
        <div class="col w-full mt-6">
          <svg class="w-full" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet"
            style="overflow: visible; margin: 10px 20px 25px 25px">
            <!-- y axis, 0-24hrs -->
            <line x1="0" y1="0" x2="0" :y2="H" :stroke="colors.lighter" stroke-width="1"
              vector-effect="non-scaling-stroke" />
            <text v-for="t in yTicks" :key="t" class="tick" x="-0.6" :y="yPix(t)" text-anchor="end"
              :fill="colors.lighter">{{ t }}</text>
            <!-- june solstice marker -->
            <line :x1="juneX" :y1="yPix(jan)" :x2="juneX" :y2="yPix(midsummer)" :stroke="colors.grey" stroke-width="1"
              stroke-linecap="round" vector-effect="non-scaling-stroke" />
            <text :x="juneX + 2" :y="yPix(2) - 5" dy="1.2em" :fill="colors.lightgrey" style="font-size: 4px">{{ hrDiff
              }}</text>
            <!-- daylight area -->
            <path :d="linePath" fill="none" :stroke="colors.sky" stroke-width="2" vector-effect="non-scaling-stroke" />
            <path :d="areaPath" :fill="colors.sky" fill-opacity="0.3" stroke="none" />
            <!-- dotted winter/summer lines -->
            <line x1="0" :y1="yPix(jan)" :x2="W" :y2="yPix(jan)" :stroke="colors.grey" stroke-width="1"
              stroke-dasharray="4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            <line x1="0" :y1="yPix(midsummer)" :x2="W" :y2="yPix(midsummer)" :stroke="colors.grey" stroke-width="1"
              stroke-dasharray="4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          </svg>

          <!-- change per month -->
          <div class="w-full mt-6 text-center" :style="{ color: colors.grey }">
            <span class="underline">change:</span>
            <table class="w-full mt-6 text-center">
              <tr class="underline">
                <td v-for="m in months" :key="m">{{ m }}</td>
              </tr>
              <tr class="h-9">
                <td v-for="(d, i) in monthDiffs" :key="i"><span class="text-2xl">{{ d }}</span></td>
              </tr>
            </table>
          </div>

          <!-- change per day/week at the equinoxes -->
          <table class="w-full mt-9 text-center" :style="{ color: colors.grey }">
            <tr class="underline">
              <td>spring Equinox</td>
              <td>fall Equinox</td>
            </tr>
            <tr>
              <td><span class="text-2xl">{{ signed(eq.spring.day) }} mins</span> / day</td>
              <td><span class="text-2xl">{{ signed(eq.fall.day) }} mins</span> / day</td>
            </tr>
            <tr>
              <td><span class="text-2xl">{{ signed(eq.spring.week) }} mins</span> / week</td>
              <td><span class="text-2xl">{{ signed(eq.fall.week) }} mins</span> / week</td>
            </tr>
          </table>
        </div>
      </template>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome">source</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* vertical slider, north at the top */
.vslider {
  writing-mode: vertical-lr;
  direction: rtl;
  width: 8px;
  height: 175px;
  padding: 0 5px;
  cursor: pointer;
}

/* somehow's .somehow-legible tick labels */
.tick {
  font-size: 2px;
}

@media (max-width: 600px) {
  .tick {
    font-size: 4px;
  }
}
</style>
