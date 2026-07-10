<script setup>
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import games from './games.js'

definePageMeta({
  title: 'Skydome open-roof games, by year',
  description: 'Blue Jays home games played with the roof open, 2010-2020',
})

// -- config --
const tz = 'Canada/Eastern' // fixed zone keeps prerender + client identical
const height = 1200 // px
const start = spacetime('March 20 2020', tz)
const end = spacetime('Nov 8 2020', tz)
const openColor = colors.sky
const closeColor = colors.lighter

// tiny scaleLinear: epoch -> y px (like somehow-timeline)
const scale = (epoch) => parseInt(((epoch - start.epoch) / (end.epoch - start.epoch)) * height, 10)

// a time-span as a positioned block, with the 2px margin the old Line used
const block = (s, e) => {
  const top = scale(s.epoch)
  return { top: top + 2 + 'px', height: scale(e.epoch) - top - 4 + 'px' }
}

// month + week tick labels down the left side
const ticks = (every, format) =>
  start.minus(1, 'second').every(every, end)
    .map((s) => ({ y: scale(s.epoch), label: s.format(format) }))
const months = ticks('month', '{month-short}')
const weeks = ticks('week', '{month-short} {date}')

// one column per year; each game is a 30-hour line, plotted on a 2020 calendar
const years = Object.keys(games).map((year) => ({
  year,
  games: games[year].map((g) => {
    const s = spacetime(`2020-${g.date}`, tz)
    return { ...block(s, s.add(30, 'hours')), open: g.is_open }
  }),
}))

// 2020's shortened pandemic season, drawn as a faint backbone
const season2020 = block(spacetime('2020-03-29', tz), spacetime('2020-10-01', tz))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
    </div>
    <h1>Skydome open-roof games, by year</h1>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6 max-w-full overflow-x-auto">
      <div class="m-12 overflow-y-hidden">
        <div class="timeline relative" :style="{ height: height + 'px' }">
          <!-- month ticks -->
          <div class="column" style="min-width:50px; max-width:50px">
            <div class="relative">
              <div v-for="(t, i) in months" :key="i" class="tick"
                :style="{ top: t.y + 'px', color: colors.grey, fontSize: '12px' }">{{ t.label }}</div>
            </div>
          </div>
          <!-- week ticks -->
          <div class="column" style="min-width:75px; max-width:75px">
            <div class="relative">
              <div v-for="(t, i) in weeks" :key="i" class="tick"
                :style="{ top: t.y + 'px', color: colors.lightgrey, fontSize: '8px' }">{{ t.label }}</div>
            </div>
          </div>
          <!-- one column per year -->
          <div v-for="col in years" :key="col.year" class="column" style="min-width:38px; max-width:38px">
            <div class="colLabel">{{ col.year }}</div>
            <!-- faint line for the season played in Buffalo -->
            <div v-if="col.year === '2020'" class="lineBox"
              :style="{ top: season2020.top, height: season2020.height, opacity: 0.4 }">
              <div class="line" :style="{ width: '3px', backgroundColor: colors.lightgrey }"></div>
            </div>
            <!-- games: open-roof in sky-blue, dome closed in pale grey -->
            <div v-for="(g, i) in col.games" :key="i" class="lineBox"
              :style="{ top: g.top, height: g.height, opacity: 0.7 }">
              <div class="line" :style="{ width: '15px', backgroundColor: g.open ? openColor : closeColor }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
      <a class="link" href="https://www.baseball-reference.com/teams/TOR/">data: baseball-reference</a>
    </div>
  </div>
</template>

<style scoped>
/* ported from somehow-timeline's Timeline/Column/Ticks/Line svelte components */
.timeline {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  text-align: center;
  flex-wrap: nowrap;
}

.column {
  flex: 1;
  position: relative;
  margin: 0 20px;
  min-height: 100%;
}

.colLabel {
  font-size: 12px;
  color: steelblue;
  background-color: #fbfbfb;
  text-align: center;
}

.tick {
  position: absolute;
  padding: 0 4px;
  white-space: nowrap;
  text-align: left;
  height: 1.2rem;
  opacity: 0.6;
  transform: translate(0px, -8px);
}

/* absolute wrapper that centers its line in the column */
.lineBox {
  width: 100%;
  position: absolute;
  border-radius: 5px;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
}

.line {
  height: 100%;
  cursor: default;
  border-radius: 3px;
  z-index: 1;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.line:hover {
  opacity: 1;
  box-shadow: 2px 2px 8px 0px steelblue;
}
</style>
