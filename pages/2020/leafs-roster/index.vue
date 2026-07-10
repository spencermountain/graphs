<script setup>
import spacetime from 'spacetime'
import byCol from './byCol2.json'
import colors from '~/assets/colors.js'

definePageMeta({
  title: 'Toronto Maple Leafs roster changes',
  description: 'player tenures on the Leafs, 2008-2022',
})

// -- config (from the original Post.svelte) --
const tz = 'America/Toronto' // fixed tz keeps SSR + client positions identical
const start = spacetime('nov 1 2008', tz)
const end = spacetime('dec 31 2022', tz)
const height = 1500 // px
const lineMargin = 5 // px gap at each end of a player bar

// start-year → named color (cycles blue/red/fuscia/navy)
const yearColors = {
  2009: 'blue', 2010: 'red', 2011: 'fuscia', 2012: 'navy',
  2013: 'blue', 2014: 'red', 2015: 'fuscia', 2016: 'navy',
  2017: 'blue', 2018: 'red', 2019: 'fuscia', 2020: 'navy',
  2021: 'blue', 2022: 'red', 2023: 'fuscia',
}

// tiny linear scale: epoch → px from top (ported from somehow-timeline)
const scale = (epoch) => parseInt(((epoch - start.epoch) / (end.epoch - start.epoch)) * height, 10)

// tick rows: year-number labels at each decade + each year
const makeTicks = (every) =>
  start.minus(1, 'second').every(every, end).map((s) => ({ top: scale(s.epoch), label: s.format('year') }))
const decadeTicks = makeTicks('decade')
const yearTicks = makeTicks('year')

// player bars, positioned by jan-1 start + tenure in months
const cols = byCol.map((list) =>
  list.map((p) => {
    let s = spacetime('jan 1 ' + p.start, tz)
    let e = s.add(p.years * 12, 'months')
    return {
      name: p.name,
      title: p.start + '-' + p.years,
      top: scale(s.epoch) + lineMargin,
      height: scale(e.epoch) - scale(s.epoch) - lineMargin * 2,
      color: colors[yearColors[p.start]] || colors.blue,
    }
  })
)
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1 class="text-2xl font-semibold text-gray-700 mt-2">Toronto Maple Leafs roster changes</h1>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6 w-full max-w-[1500px]">
      <div style="overflow-y:hidden; overflow-x:auto">
        <div class="timeline" :style="{ height: height + 'px' }">
          <!-- decade + year tick gutters -->
          <div class="ticks">
            <div v-for="t in decadeTicks" :key="t.top" class="tick" style="color:grey; font-size:12px"
              :style="{ top: t.top + 'px' }">{{ t.label }}</div>
          </div>
          <div class="ticks">
            <div v-for="t in yearTicks" :key="t.top" class="tick" style="color:lightgrey; font-size:8px"
              :style="{ top: t.top + 'px' }">{{ t.label }}</div>
          </div>

          <!-- one column per roster slot -->
          <div v-for="(list, i) in cols" :key="i" class="column">
            <div v-for="p in list" :key="p.name" class="bar" :title="p.title"
              :style="{ top: p.top + 'px', height: p.height + 'px' }">
              <div class="midLabel">{{ p.name }}</div>
              <div class="line" :style="{ backgroundColor: p.color }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://www.hockey-reference.com/teams/TOR/">hockey-reference.com</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* ported from somehow-timeline (Timeline / Ticks / Column / Line) */
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

.ticks {
  position: relative;
  min-width: 40px;
  min-height: 100%;
}

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

.column {
  flex: 1;
  position: relative;
  min-height: 100%;
  max-width: 25px;
  min-width: 25px;
  margin: 0px 20px;
}

/* one player's tenure */
.bar {
  width: 100%;
  position: absolute;
  border-radius: 5px;
  opacity: 0.5;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  text-align: center;
  flex-wrap: wrap;
  align-self: stretch;
}

.line {
  height: 100%;
  width: 100%;
  cursor: default;
  border-radius: 3px;
  z-index: 1;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.line:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}

/* rotated name inside the bar */
.midLabel {
  position: absolute;
  z-index: 3;
  color: #fbfbfb;
  font-size: 12px;
  line-height: 1.2rem;
  white-space: nowrap;
  writing-mode: vertical-lr;
  transform: rotate(-180deg);
}

@media only screen and (max-width: 600px) {
  .midLabel {
    font-size: 11px;
  }
}
</style>
