<script setup>
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'

import atlas from './data/atlas.json'
import saturn5 from './data/saturn5.json'
import china from './data/china.json'
import japan from './data/japan.json'
import shuttle from './data/shuttle.json'
import spacex from './data/spacex.json'
import india from './data/india.json'
import proton from './data/proton.json'
import zenit from './data/zenit.json'
import rokot from './data/rokot.json'
import soyuz from './data/soyuz.json'

definePageMeta({
  title: 'Rocket Launches',
  description: 'every launch of eleven rocket families — 1956 to 2021',
})

// -- timeline config (from the original Post.svelte) --
const height = 3500
const start = spacetime('Jan 1 1956')
const end = spacetime('Dec 31 2021')

// tiny scaleLinear: epoch -> px from top (parseInt-truncation, like somehow-timeline)
const scale = (epoch) => Math.trunc((height * (epoch - start.epoch)) / (end.epoch - start.epoch))

// Ticks.svelte — one label per decade/year, underline years ending in '00'
const makeTicks = (every) =>
  start.minus(1, 'second').every(every, end).map((d) => {
    const label = d.format('year')
    return { y: scale(d.epoch), label, underline: /00$/.test(label) }
  })
const decades = makeTicks('decade')
const years = makeTicks('year')

// one column per rocket family — each launch date becomes a small dash
const families = [
  { label: 'Saturn 5', list: saturn5, color: 'blue', opacity: 0.5 },
  { label: 'Atlas', list: atlas, color: 'sea', opacity: 0.5 },
  { label: 'Shuttle', list: shuttle, color: 'pink', opacity: 0.7 },
  { label: 'China', list: china, color: 'orange', opacity: 0.5 },
  { label: 'Japan', list: japan, color: 'yellow', opacity: 0.5 },
  { label: 'SpaceX', list: spacex, color: 'sea', opacity: 0.5 },
  { label: 'India', list: india, color: 'suede', opacity: 0.5 },
  { label: 'Proton', list: proton, color: 'red', opacity: 0.5 },
  { label: 'Zenit', list: zenit, color: 'red', opacity: 0.5, labelColor: 'red' },
  { label: 'Rokot', list: rokot, color: 'red', opacity: 0.5, labelColor: 'red' },
  { label: 'Soyuz', list: soyuz, color: 'red', opacity: 0.5, labelColor: 'red' },
].map((f) => ({
  ...f,
  hex: colors[f.color],
  labelHex: f.labelColor ? colors[f.labelColor] : 'steelblue', // Column.svelte default
  tops: f.list.map((r) => scale(spacetime(r.date).epoch)),
}))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-6">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Rocket Launches</h1>
    </div>

    <!-- the timeline card -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl">
      <div class="timeline" :style="{ height: height + 'px' }">
        <!-- decade ticks -->
        <div class="column part ticks" style="max-width: 15px; min-width: 15px">
          <div v-for="t in decades" :key="t.label" class="tick" :class="{ underline: t.underline }"
            :style="{ top: t.y + 'px', color: colors.grey, fontSize: '12px' }">
            {{ t.label }}
          </div>
        </div>
        <!-- year ticks -->
        <div class="column part ticks" style="max-width: 15px; min-width: 15px">
          <div v-for="t in years" :key="t.label" class="tick" :class="{ underline: t.underline }"
            :style="{ top: t.y + 'px', color: colors.lightgrey, fontSize: '8px' }">
            {{ t.label }}
          </div>
        </div>

        <!-- one column of dashes per rocket family -->
        <div v-for="f in families" :key="f.label" class="column part" style="max-width: 40px; min-width: 40px">
          <div class="label" :style="{ color: f.labelHex }">{{ f.label }}</div>
          <div v-for="(top, i) in f.tops" :key="i" class="dash"
            :style="{ top: top + 'px', backgroundColor: f.hex, opacity: f.opacity }"></div>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <span>data from Wikipedia launch lists</span>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* Timeline.svelte */
.timeline {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
  margin: 1rem;
}

.part {
  min-height: 100%;
}

/* Column.svelte */
.column {
  flex: 1;
  position: relative;
  margin: 0px 20px;
}

.column .label {
  color: grey;
  font-size: 12px;
  background-color: #fbfbfb;
  display: block;
  z-index: 4;
  text-align: center;
}

@media only screen and (max-width: 600px) {
  .column {
    margin: 0px 5px !important;
  }

  .column .label {
    font-size: 11px;
  }
}

/* Ticks.svelte */
.tick {
  position: absolute;
  padding-left: 4px;
  padding-right: 4px;
  white-space: nowrap;
  text-align: left;
  height: 1.2rem;
  opacity: 0.6;
  transform: translate(0px, -8px);
}

.tick.underline {
  opacity: 1;
  border-bottom: 1px solid grey;
}

/* Dash.svelte — one launch */
.dash {
  position: absolute;
  border-radius: 2px;
  width: 100%;
  min-width: 25px;
  height: 3px;
}
</style>
