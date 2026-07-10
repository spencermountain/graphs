<script setup>
import colors from '~/assets/colors.js'
import teamColors from './teamColors.js'
import arenas from './arenas.js'

definePageMeta({ title: 'NHL arenas', description: 'oldest arenas' })

// chart geometry — same world as the original somehow({height:900, width:700})
const W = 700
const H = 900
const FONT = 9 // label font-size

// every arena date in the original was 'Oct 1 <year>' (UTC keeps it SSR-deterministic)
const oct = (yr) => Date.UTC(yr, 9, 1)
const jan = (yr) => Date.UTC(yr, 0, 1)

// fit() — x spans first opening to last closing; y spans row 0..n-1
const minX = Math.min(...arenas.map((a) => oct(a.start)))
const maxX = Math.max(...arenas.map((a) => oct(a.end)))
const maxI = arenas.length - 1

// somehow's tiny scaleLinear truncated to whole pixels
const xOf = (epoch) => Math.floor((W * (epoch - minX)) / (maxX - minX))
const yOf = (i) => Math.floor((H * (maxI - i)) / maxI) // row 0 (newest) at the bottom

// one horizontal line + right-side label per arena
const rows = arenas.map((a, i) => ({
  name: a.name,
  city: a.city,
  color: teamColors[a.team] || colors.blue,
  x1: xOf(oct(a.start)),
  x2: xOf(oct(a.end)),
  y: yOf(i),
}))

// x-axis year ticks, ported from spacetime-ticks:
// every Jan 1 inside the range, halved until ≤6 remain -> 1910, 1942, 1974, 2006
let years = []
for (let y = new Date(minX).getUTCFullYear() + 1; jan(y) < maxX; y += 1) {
  years.push(y)
}
while (years.length > 6) {
  years = years.filter((_, i) => i % 2 === 0)
}
const ticks = years.map((y) => ({
  label: String(y),
  x: (Math.floor(((jan(y) - minX) / (maxX - minX)) * 1000) / 1000) * W,
}))

// somehow's Text dodge: x + 2 + dx(4); baseline = y + 4 - font*1.5 + 1.2em tspan
const labelX = (a) => a.x2 + 6
const labelY = (a) => a.y + 4 - FONT * 1.5 + FONT * 1.2
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start ml-2">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl text-gray-700 mt-2">NHL arenas</h1>
      <div class="text-gray-400">oldest arenas</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-4">
      <svg :width="W" :height="H" :viewBox="`0,0,${W},${H}`" preserveAspectRatio="xMidYMid meet"
        class="max-w-full h-auto" style="overflow: visible; margin: 10px 20px 25px 25px">
        <!-- x-axis -->
        <g>
          <text v-for="t in ticks" :key="t.label" :x="t.x" :y="H + 15" fill="#d7d5d2" text-anchor="middle"
            style="font-size: 12px">{{ t.label }}</text>
          <line x1="0" :y1="H" :x2="W" :y2="H" stroke="#d7d5d2" stroke-width="1" />
        </g>
        <!-- one tenure line + name label per arena -->
        <g v-for="(a, i) in rows" :key="i">
          <line :x1="a.x1" :y1="a.y" :x2="a.x2" :y2="a.y" :stroke="a.color" stroke-width="4" stroke-linecap="round">
            <title>{{ a.name + '\n' + a.city }}</title>
          </line>
          <text :x="labelX(a)" :y="labelY(a)" :fill="a.color" :font-size="FONT">{{ a.name }}</text>
        </g>
      </svg>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome">source</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>
