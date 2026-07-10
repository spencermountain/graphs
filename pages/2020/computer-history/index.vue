<script setup>
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'

definePageMeta({
  title: 'Timeline of computer programming',
  description: 'languages, companies, and events — 1940 to 2020',
})

// -- timeline config (ported from somehow-timeline) --
const height = 700
const startDate = '1940'
const endDate = 'Dec 30 2020' // the post was made in 2020; 'today' in the source meant this
const start = spacetime(startDate)
const end = spacetime(endDate)

// tiny scaleLinear: epoch -> px from top (parseInt-truncation, like the original)
const scale = (epoch) => Math.trunc((height * (epoch - start.epoch)) / (end.epoch - start.epoch))
const toY = (str) => scale(spacetime(str === 'today' ? endDate : str).epoch)
const toColor = (c) => colors[c] || c // falls through to css names like 'silver', 'lightblue'

// axis ticks — 80yr span → one per decade, underline the century
const ticks = []
for (let yr = 1940; yr <= 2020; yr += 10) {
  ticks.push({ y: toY(String(yr)) - 5, label: String(yr), underline: /00$/.test(String(yr)) })
}

// full-width horizontal event lines
const horizontals = [
  { date: '1940', label: 'theory of communication', align: 'right', color: 'rose', width: '50%', left: '25%' },
  { date: 'December 1968', label: 'Engelbart demo', align: 'right', color: 'pink', width: '40%', left: '25%' },
].map((h) => ({ ...h, y: toY(h.date), hex: toColor(h.color) }))

// columns of vertical bars — 'label' renders rotated beside the bar, 'topLabel' floats above it
const columns = [
  {
    width: '100px',
    bars: [
      { start: '1939', end: '1945', color: 'fire', label: 'ww2' },
      { start: '1945', end: '1986', color: 'sky', label: 'cold war' },
      { start: 'February 7, 1958', end: '1970', color: 'suede', label: 'DARPA', size: '11px', dodge: '25px' },
      { start: 'January 1991', end: 'today', color: 'lightblue', topLabel: 'www', size: '12px' },
    ],
  },
  {
    // languages
    width: '100px',
    bars: [
      { start: '1972', end: 'today', color: 'orange', topLabel: 'C', dodge: '10px' },
      { start: '1990', end: 'today', color: 'purple', topLabel: 'Python', dodge: '40px' },
      { start: 'January 1996', end: 'today', color: 'suede', topLabel: 'Java', dodge: '70px' },
      { start: 'December 4 1995', end: 'today', color: '#c6ce7d', topLabel: 'Js', dodge: '-20px' },
    ],
  },
  // companies
  { width: '65px', bars: [{ start: 'April 4, 1975', end: 'today', color: 'blue', topLabel: 'Microsoft' }] },
  { width: '65px', bars: [{ start: 'April 1, 1976', end: 'today', color: 'silver', topLabel: 'Apple' }] },
  { width: '65px', bars: [{ start: 'September 4, 1998', end: 'today', color: 'orange', topLabel: 'Google' }] },
  { width: '65px', bars: [{ start: 'February 4, 2004', end: 'today', color: 'navy', topLabel: 'Facebook' }] },
].map((c) => ({
  ...c,
  bars: c.bars.map((b) => {
    const top = toY(b.start)
    return { ...b, top, barHeight: toY(b.end) - top, hex: toColor(b.color) }
  }),
}))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-6">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Timeline of computer programming</h1>
    </div>

    <!-- the timeline card -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl">
      <div class="timeline" :style="{ height: height + 'px' }">
        <!-- year axis -->
        <div class="axis">
          <div v-for="t in ticks" :key="t.label" class="tick" :class="{ century: t.underline }"
            :style="{ top: t.y + 'px' }">
            {{ t.label }}
          </div>
        </div>

        <!-- wide horizontal event lines -->
        <div v-for="h in horizontals" :key="h.label" class="horizontal"
          :style="{ top: h.y + 'px', width: h.width, left: h.left, textAlign: h.align, color: h.hex, backgroundColor: h.hex }">
          <div class="hlabel">{{ h.label }}</div>
        </div>

        <!-- columns of bars -->
        <div v-for="(c, i) in columns" :key="i" class="column part"
          :style="{ maxWidth: c.width, minWidth: c.width }">
          <div v-for="b in c.bars" :key="b.topLabel || b.label" class="bar"
            :style="{ top: b.top + 2 + 'px', left: b.dodge || '0px', height: b.barHeight - 4 + 'px' }">
            <div v-if="b.topLabel" class="top" :style="{ color: b.hex, fontSize: b.size || '0.8rem' }">
              {{ b.topLabel }}
            </div>
            <div class="line" :style="{ backgroundColor: b.hex }"></div>
            <div v-if="b.label" class="side" :style="{ color: b.hex, fontSize: b.size || '0.8rem' }">
              {{ b.label }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
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

/* Axis.svelte */
.axis {
  position: relative;
  min-width: 50px;
}

.tick {
  position: absolute;
  white-space: nowrap;
  left: 6px;
  text-align: left;
  transform: translate(0px, -8px);
  opacity: 0.5;
  height: 1.3rem;
  font-size: 12px;
  color: #949a9e;
}

/* underline the century tick (2000) */
.tick.century {
  border-bottom: 1px solid grey;
  opacity: 1;
}

/* Horizontal.svelte */
.horizontal {
  position: absolute;
  height: 5px;
  min-height: 3px;
  cursor: default;
  border-radius: 3px;
  z-index: 1;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  font-size: 0.8rem;
}

.horizontal:hover {
  opacity: 1;
  box-shadow: 2px 2px 8px 0px steelblue;
}

.hlabel {
  margin: 10px;
}

/* Column.svelte */
.column {
  flex: 1;
  position: relative;
  margin: 0px 20px;
}

@media only screen and (max-width: 600px) {
  .column {
    margin: 0px 5px !important;
  }
}

/* Label.svelte — one dated bar */
.bar {
  position: absolute;
  width: 150px;
  opacity: 0.7;
  border-radius: 5px;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  text-align: left;
  flex-wrap: nowrap;
}

.bar .line {
  height: 100%;
  width: 25px;
  cursor: default;
  border-radius: 3px;
  z-index: 1;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.bar .line:hover {
  opacity: 1;
  box-shadow: 2px 2px 8px 0px steelblue;
}

/* floats above the bar's start */
.bar .top {
  position: absolute;
  top: -1.5rem;
  width: 100%;
}

/* rotated label beside the bottom of the bar */
.bar .side {
  position: absolute;
  margin-left: 0.8rem;
  bottom: 0px;
  width: 50px;
  height: 20px;
  transform: rotate(270deg);
  white-space: nowrap;
}
</style>
