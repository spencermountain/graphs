<script setup>
import getWeeks from './getWeeks.js'

definePageMeta({ title: 'Weeks of the Year', description: 'weeks of the year, by their month' })

// 30 years of week-bars (1999–2028), each week tagged with its month
const byYear = []
let year = 1998
for (let i = 0; i < 30; i += 1) {
  year += 1
  byYear.push({ year, weeks: getWeeks(year) })
}

// month → bar color (hex values from the original post)
// the original map had a 'febuary' typo, so february always fell back to
// the css 'steelblue' default — kept, to match the rendered original
const monthColors = {
  january: '#cc7066',
  february: 'steelblue',
  march: '#c67a53',
  april: '#8BA3A2',
  may: '#dfb59f',
  june: '#C4ABAB',
  july: '#cc6966',
  august: '#275291',
  september: '#914045',
  october: '#8BA3A2',
  november: '#978BA3',
  december: '#2D85A8',
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1>Weeks of the Year</h1>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-[1500px] overflow-x-auto">
      <div class="all">
        Weeks of the year, by their month
        <a class="link" href="https://en.wikipedia.org/wiki/ISO_week_date"><sup>[1]</sup></a>
      </div>
      <div class="chart-row all">
        <div v-for="yr in byYear" :key="yr.year" class="year-col">
          <div class="year">{{ yr.year }}</div>
          <template v-for="(wk, i) in yr.weeks" :key="i">
            <div v-if="wk.gap === true" class="gap"></div>
            <div v-else class="week" :style="{ backgroundColor: monthColors[wk.month] }" :title="wk.title"></div>
          </template>
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
/* styles copied from the original Post.svelte */
.all {
  margin: 3rem;
  min-width: 700px;
}

.chart-row {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
}

.year-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
  flex: 1;
}

.week {
  font-size: 10px;
  margin-top: 2px;
  margin-left: 3px;
  height: 12px;
  background-color: steelblue;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  width: 94%;
}

.gap {
  height: 8px;
}

.year {
  font-size: 12px;
  color: grey;
}

@media only screen and (max-width: 1350px) {
  .year {
    font-size: 8px;
  }

  .all {
    margin-left: 1rem;
    margin-right: 1rem;
  }
}
</style>
