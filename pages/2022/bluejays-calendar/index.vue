<script setup>
import Quarter from './Quarter.vue'
import { fmtDays } from './calendar.js'
import games from './games.js'

definePageMeta({ title: 'Bluejays Calendar 2022', description: '2022 Toronto Blue Jays schedule' })

// day-games colour the top half of the square, night-games the bottom.
// blue = home, lighter = away
let tops = {}
let bottoms = {}
let isHome = {}
games.forEach((g) => {
  if (g.home) {
    isHome[g.date] = true
  }
  if (g.daytime) {
    tops[g.date] = g.home ? 'steelblue' : 'lightsteelblue'
  } else {
    bottoms[g.date] = g.home ? 'steelblue' : 'lightsteelblue'
  }
})
tops = fmtDays(tops)
bottoms = fmtDays(bottoms)
isHome = fmtDays(isHome)
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1 class="text-xl font-semibold text-gray-700 mt-2 mb-6">Bluejays Calendar 2022</h1>

    <!-- the season, one quarter per row -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-[1000px]">
      <Quarter date="2022-04-01" :tops="tops" :bottoms="bottoms" :is-home="isHome" />
      <Quarter date="2022-07-01" :tops="tops" :bottoms="bottoms" :is-home="isHome" />
      <Quarter date="2022-10-01" :tops="tops" :bottoms="bottoms" :is-home="isHome" />
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>
