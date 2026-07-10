<script setup>
import { ref, computed } from 'vue'
import colors from '~/assets/colors.js'
import schedules from './schedules.js'

definePageMeta({ title: '2019 MLB calendar', description: 'home + away games for every team' })

// -- config (from the original index.js) --
const HOME = '#415abe' // home game
const AWAY = '#5969a6' // away game
const WEEKEND = '#ededed' // somehow-calendar's show_weekends shading

const teams = schedules.map((o) => o.team)
const team = ref('Toronto Blue Jays')

// -- calendar grid: March–October 2019, monday-start weeks (somehow-calendar v0.2.1) --
const year = 2019
const monthNames = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct']
const monthNums = [2, 3, 4, 5, 6, 7, 8, 9]
const grid = monthNums.map((m, i) => {
  const pad = (new Date(year, m, 1).getDay() + 6) % 7 // blanks before the 1st
  const len = new Date(year, m + 1, 0).getDate()
  const cells = [...Array(pad).fill(null), ...Array.from({ length: len }, (_, d) => d + 1)]
  while (cells.length % 7) cells.push(null) // blanks after the last day
  const weeks = []
  for (let w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7))
  return { m, name: monthNames[i], weeks }
})

// 'March 28' or 'Sep 1' -> '2-28' / '8-1' key
const moIdx = { mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9 }
const keyOf = (str) => {
  const [mo, d] = str.split(' ')
  return moIdx[mo.slice(0, 3).toLowerCase()] + '-' + d
}

// date-key -> color, for the selected team
const gameColors = computed(() => {
  const map = {}
  const games = schedules.find((o) => o.team === team.value).games
  games.forEach((g) => (map[keyOf(g.date)] = g.home ? HOME : AWAY))
  return map
})

// weekends shaded, game days colored on top (like the original)
const cellStyle = (month, d, pos) => {
  const bg = gameColors.value[month.m + '-' + d] || (pos >= 5 ? WEEKEND : null)
  return bg ? { backgroundColor: bg } : null
}

const ord = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-semibold" :style="{ color: colors.brown }">2019 MLB calendar</h1>
      <div class="text-gray-400 text-sm">home + away games for every team</div>
    </div>

    <!-- card -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-2xl">
      <!-- team select + year -->
      <div class="row mb-4">
        <select v-model="team"
          class="border border-gray-200 rounded px-2 py-1 bg-white cursor-pointer text-center min-w-[10rem]"
          :style="{ color: colors.light }">
          <option v-for="t in teams" :key="t" :value="t">{{ t }}</option>
        </select>
        <div class="text-2xl" :style="{ color: colors.grey }">2019</div>
      </div>

      <!-- months -->
      <div class="flex flex-row flex-wrap justify-start items-start text-center">
        <div v-for="month in grid" :key="month.m" class="month">
          <div class="month-name">{{ month.name }}</div>
          <div v-for="(week, wi) in month.weeks" :key="wi" class="week">
            <div v-for="(d, pos) in week" :key="pos" class="day" :class="{ 'opacity-0': d === null }"
              :style="d ? cellStyle(month, d, pos) : null" :title="d ? `${month.name} ${ord(d)}, ${year}` : null">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://github.com/spencermountain/thensome">source</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* styles lifted from somehow-calendar v0.2.1 months mode */
.month {
  margin: 0.35rem;
}

.month-name {
  font-size: 0.53rem;
  color: #838b91;
  text-align: right;
  margin: 0.2rem 0.7rem 0.2rem 0;
}

.week {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  align-self: stretch;
}

.day {
  flex: 1;
  min-width: 2rem;
  height: 2rem;
  border: 1px solid #d7d5d2;
  box-sizing: border-box;
  border-radius: 3px;
  overflow: hidden;
}
</style>
