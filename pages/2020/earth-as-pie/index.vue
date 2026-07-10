<script setup>
import colors from '~/assets/colors.js'
import { polar, arcPath, labelAngle } from './circle.js'

definePageMeta({ title: 'Earth as a pie-chart', description: 'at 40° N' })

// -- config
const rotate = 50 // spin the globe so the pie sits nicely
const margin = 15 // breathing-room outside the arcs, for labels
const arcR = 60 // arc inner radius (pre-scale)
const arcW = 5 // arc thickness (pre-scale)
const labelR = 68 // city-label radius (pre-scale)

// cities sitting near 40°N, with their longitude
const points = [
  ['New York', -73],
  ['Barcelona', -8.5],
  ['Istanbul', 28],
  ['Tehran', 50],
  ['Beijing', 116],
  ['Seoul', 126],
  ['Tokyo', 138],
  ['Salt Lake City', -112],
  ['Denver', -106],
  ['St Louis', -88],
]
// [name, from-longitude, to-longitude] at 40°N
const oceans = [
  ['Atlantic', -69, -9],
  ['Pacific', 144, 236],
]
const continents = [
  ['America', -123, -70],
  ['Eurasia', -8, 143],
]

// -180..180 longitude → 0..360 degrees around the circle
const toDeg = (n) => n + 180 - rotate
// scale radii so arcs + margin fill the -50..50 viewbox (somehow-circle layout)
const rs = (r) => (r * 50) / (arcR + arcW + margin)

const arc = (a, color) => ({
  name: a[0],
  color,
  path: arcPath(toDeg(a[1]), toDeg(a[2]), rs(arcR), rs(arcR + arcW)),
})
const arcs = [...oceans.map((a) => arc(a, colors.blue)), ...continents.map((a) => arc(a, colors.orange))]

const labels = points.map(([text, lng]) => {
  const deg = toDeg(lng)
  const [x, y] = polar(deg, rs(labelR))
  const { angle, flip } = labelAngle(deg)
  return { text, x, y, angle, anchor: flip ? 'start' : 'end' }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="w-full max-w-[1000px] col-left">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl text-gray-700 mt-2">Earth as a pie-chart</h1>
      <div class="text-gray-400 mb-4">at 40° N</div>
    </div>

    <!-- the pie -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-[1000px]">
      <svg viewBox="-50 -50 100 100" shape-rendering="geometricPrecision" class="w-full">
        <path v-for="a in arcs" :key="a.name" :d="a.path" stroke="none" :fill="a.color">
          <title>{{ a.name }}</title>
        </path>
        <text
          v-for="l in labels"
          :key="l.text"
          :x="l.x"
          :y="l.y"
          :transform="`rotate(${l.angle},${l.x},${l.y})`"
          font-size="1.5"
          :text-anchor="l.anchor"
          :fill="colors.grey"
        >
          {{ l.text }}
        </text>
      </svg>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
path {
  pointer-events: all;
}
path:hover {
  filter: drop-shadow(0px 1px 1px steelblue);
}
</style>
