<script setup>
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'

definePageMeta({
  title: 'Public transit development in Canada',
  description: 'rapid-transit lines by city, 1940 to 2020',
})

// -- timeline config (ported from somehow-timeline) --
const height = 700
const startDate = '1940'
const endDate = 'Dec 30 2020' // the post is from 2020; 'today' in the source meant this
const start = spacetime(startDate)
const end = spacetime(endDate)

// tiny scaleLinear: epoch -> px from top (parseInt-truncation, like the original)
const scale = (epoch) => Math.trunc((height * (epoch - start.epoch)) / (end.epoch - start.epoch))
const toY = (str) => scale(spacetime(str).epoch)

// axis ticks — 80yr span → one per decade, underline the century
const ticks = []
for (let yr = 1940; yr <= 2020; yr += 10) {
  ticks.push({ y: toY(String(yr)) - 5, label: String(yr), underline: /00$/.test(String(yr)) })
}

// each city: a fixed-width column with its name pinned at a date, plus one bar
// per transit line, opening date → 'today'. 'topLabel' floats above the bar;
// 'label' renders rotated at the bar's bottom.
const cities = [
  {
    name: 'Vancouver', date: '1965', width: '120px',
    lines: [
      { start: '1985', color: 'blue', topLabel: 'expo' },
      { start: 'August 17, 2009', color: 'sky', topLabel: 'canada', dodge: '30px' },
      { start: 'October 22, 2016', color: 'yellow', topLabel: 'millenium', dodge: '60px' },
    ],
  },
  {
    name: 'Calgary', date: '1965', width: '100px',
    lines: [{ start: '1981', color: 'red', topLabel: 'cTrain' }],
  },
  {
    name: 'Edmonton', date: '1965', width: '100px',
    lines: [
      { start: '1978', color: 'fire', topLabel: 'metro' },
      { start: '2010', color: 'blue', topLabel: 'capital', dodge: '30px' },
    ],
  },
  {
    name: 'Toronto', date: '1943', width: '200px',
    lines: [
      { start: '1954', color: 'yellow', topLabel: 'yonge' },
      { start: '1966', color: 'green', topLabel: 'bloor', dodge: '30px' },
      { start: '1985', color: 'sky', topLabel: 'scarborough', dodge: '60px' },
      { start: '1985', color: 'purple', label: 'sheppard', dodge: '90px' },
    ],
  },
  {
    name: 'Ottawa', date: '1965', width: '120px',
    lines: [
      { start: 'October 15, 2001', color: 'green', topLabel: 'trillium' },
      { start: 'September 14, 2019', color: 'red', label: 'confederation', dodge: '30px' },
    ],
  },
  {
    name: 'Montreal', date: '1960', width: '100px',
    lines: [
      { start: 'October 1966', color: 'green', topLabel: 'Green' },
      { start: 'October 14, 1966', color: 'orange', topLabel: 'Orange', dodge: '30px' },
      { start: 'April 28, 1967', color: 'yellow', topLabel: 'Yellow', dodge: '60px' },
      { start: '16 June 1986', color: 'blue', topLabel: 'Blue', dodge: '90px' },
    ],
  },
].map((c) => ({
  ...c,
  nameY: toY(c.date),
  lines: c.lines.map((l) => {
    const top = toY(l.start)
    return { ...l, top, barHeight: height - top, hex: colors[l.color] } // bars run to the timeline end
  }),
}))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-6">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Public transit development in Canada</h1>
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

        <!-- one column per city -->
        <div v-for="c in cities" :key="c.name" class="column part"
          :style="{ maxWidth: c.width, minWidth: c.width }">
          <!-- city name, pinned at its date -->
          <div class="city" :style="{ top: c.nameY + 'px', color: colors.blue }">{{ c.name }}</div>

          <!-- transit-line bars -->
          <div v-for="l in c.lines" :key="l.topLabel || l.label" class="bar"
            :style="{ top: l.top + 2 + 'px', left: l.dodge || '0px', height: l.barHeight - 4 + 'px' }">
            <div v-if="l.topLabel" class="top" :style="{ color: l.hex }">{{ l.topLabel }}</div>
            <div class="line" :style="{ backgroundColor: l.hex }"></div>
            <div v-if="l.label" class="side" :style="{ color: l.hex }">{{ l.label }}</div>
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

/* Column.svelte — no margins in this build */
.column {
  flex: 1;
  position: relative;
}

/* Text.svelte — city name; underline={true} on every one in the original */
.city {
  position: absolute;
  min-width: 25px;
  font-size: 1rem;
  text-align: center;
  border-bottom: 1px solid steelblue;
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
  font-size: 0.8rem;
}

/* rotated label beside the bottom of the bar */
.bar .side {
  position: absolute;
  margin-left: 0.8rem;
  bottom: 0px;
  width: 50px;
  height: 20px;
  font-size: 0.8rem;
  transform: rotate(270deg);
  white-space: nowrap;
}
</style>
