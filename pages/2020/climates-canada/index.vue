<script setup>
import spacetime from 'spacetime'
import data from './data.js'
import colors from '~/assets/colors.js'

definePageMeta({ title: 'Climates of Canadian cities', description: 'mean monthly temperatures' })

// -- config (ported from somehow-timeline usage in the original Post.svelte) --
const tz = 'Canada/Eastern' // pinned so ssr + client compute identical pixels
const start = spacetime('Dec 10 2019', tz)
const end = spacetime('Dec 30 2020', tz)
const height = 700 // px
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// tiny linear scale: epoch → y-px (was somehow-timeline/_lib/scale.js)
const scale = (epoch) => Math.floor(((epoch - start.epoch) / (end.epoch - start.epoch)) * height)

// original color buckets — 'silver' was not in the palette, fell through to css silver
const getColor = (num) => {
  if (num > 15) return colors.orange
  if (num < 0) return 'silver'
  if (num < 10) return colors.sky
  return colors.blue
}

const titleCase = (str) => str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase())

// axis: one tick per month of 2020 (was somehow-timeline Axis, auto 'month' mode)
const ticks = months.map((m) => {
  const s = spacetime(m + ' 2020', tz)
  return { label: s.format('{month-short}'), top: scale(s.epoch) - 5 }
})

// one column per city, one dash per month
const places = Object.keys(data).map((name) => ({
  name: titleCase(name),
  dashes: data[name].map((temp, i) => ({
    top: scale(spacetime(months[i] + ' 2020', tz).epoch),
    color: getColor(temp),
  })),
}))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Climates of Canadian cities</h1>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl overflow-x-auto">
      <div class="m-12">
        <div class="timeline" :style="{ height: height + 'px' }">
          <!-- month axis -->
          <div class="axis">
            <div v-for="t in ticks" :key="t.label" class="tick" :style="{ top: t.top + 'px', color: colors.lightgrey }">
              {{ t.label }}
            </div>
          </div>
          <!-- one column per city -->
          <div v-for="p in places" :key="p.name" class="column">
            <span class="text">{{ p.name }}</span>
            <div v-for="(d, i) in p.dashes" :key="i" class="dash"
              :style="{ top: d.top + 'px', backgroundColor: d.color }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
      <a class="link" href="https://en.wikipedia.org/wiki/Template:Weather_box">data: wikipedia</a>
    </div>
  </div>
</template>

<style scoped>
/* was somehow-timeline Timeline.svelte */
.timeline {
  position: relative;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: space-around;
  text-align: center;
}

/* was somehow-timeline Axis.svelte */
.axis {
  position: relative;
  min-width: 50px;
}

.tick {
  position: absolute;
  left: 6px;
  white-space: nowrap;
  text-align: left;
  transform: translate(0px, -8px);
  opacity: 0.5;
  height: 1.3rem;
  font-size: 12px;
}

/* was somehow-timeline Column.svelte */
.column {
  flex: 1;
  position: relative;
  min-height: 100%;
  margin: 0 20px;
}

/* was somehow-timeline Dash.svelte */
.dash {
  position: absolute;
  width: 100%;
  min-width: 25px;
  height: 20px;
  border-radius: 2px;
}

/* city labels, rotated on small screens (from the original Post.svelte) */
.text {
  font-size: 12px;
}

@media only screen and (max-width: 600px) {
  .text {
    display: block;
    transform: rotate(290deg) translate(20px, 0px);
  }
}
</style>
