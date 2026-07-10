<script setup>
import colors from '~/assets/colors.js'
import { weekdays, saturday, sunday } from './schedule.js'

definePageMeta({ title: 'CBC radio 1 schedule', description: '(toronto)' })

// config — timeline window 5:00am → 10:00pm, drawn 800px tall (from the original)
const height = 800
const startMin = 5 * 60 // 5:00am
const endMin = 22 * 60 // 10:00pm
const gap = 5 // px margin between pills

// '8:30am' → minutes since midnight
const toMin = (str) => {
  let [, h, m, ampm] = str.match(/(\d+):(\d+)(am|pm)/)
  return ((Number(h) % 12) + (ampm === 'pm' ? 12 : 0)) * 60 + Number(m)
}
// minutes → px from top (somehow-timeline's linear scale, parseInt included)
const scale = (min) => Math.floor(((min - startMin) / (endMin - startMin)) * height)

// one absolutely-positioned pill per show
const pill = (p) => {
  const top = scale(toMin(p.time))
  const h = scale(toMin(p.end)) - top
  return { name: p.name, color: colors[p.color] || p.color, top: top + gap, height: h - gap * 2, tall: h > 20 }
}

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const days = dayNames.map((name, i) => ({
  name,
  shows: (i === 5 ? saturday : i === 6 ? sunday : weekdays).map(pill),
}))

const noonY = scale(12 * 60) // grey rule across the week at 12:00pm
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">CBC radio 1 schedule</h1>
      <div class="text-sm text-gray-400">(toronto)</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl mt-4">
      <div class="timeline" :style="{ height: height + 'px' }">
        <div v-for="day in days" :key="day.name" class="column">
          <div class="dayLabel">{{ day.name }}</div>
          <div v-for="s in day.shows" :key="s.name + s.top" class="pill"
            :style="{ top: s.top + 'px', height: s.height + 'px' }">
            <div class="line" :style="{ backgroundColor: s.color }"></div>
            <div v-if="s.tall" class="midLabel">{{ s.name }}</div>
            <div v-else class="topLabel" :style="{ color: s.color }">{{ s.name }}</div>
          </div>
        </div>
        <!-- noon marker across all columns -->
        <div class="noon" :style="{ top: noonY + 'px' }"></div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* ported from somehow-timeline: Timeline / Column / Line / WideLabel */
.timeline {
  position: relative;
  display: flex;
  justify-content: space-around;
  text-align: center;
  margin: 1rem;
}

.column {
  flex: 1;
  position: relative;
  margin: 0 20px;
  min-height: 100%;
}

.dayLabel {
  color: steelblue;
  font-size: 12px;
  text-align: center;
}

.pill {
  position: absolute;
  width: 100%;
  border-radius: 5px;
  opacity: 0.5;
  display: flex;
  justify-content: center;
  align-items: center;
}

.line {
  position: absolute;
  inset: 0;
  border-radius: 3px;
  cursor: default;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.line:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}

/* label sits centered over the pill */
.midLabel {
  position: relative;
  z-index: 3;
  color: #fbfbfb;
  font-size: 12px;
  line-height: 1.2rem;
}

/* fallback label above short pills (unused with current data) */
.topLabel {
  position: relative;
  z-index: 4;
  width: 100%;
  white-space: nowrap;
  user-select: none;
  font-size: 11px;
}

.noon {
  position: absolute;
  left: 10%;
  width: 90%;
  min-height: 3px;
  border-bottom: 1px solid #e4e4e4;
}

@media only screen and (max-width: 600px) {
  .column {
    margin: 0 5px;
  }

  .dayLabel,
  .midLabel {
    font-size: 11px;
  }
}
</style>
