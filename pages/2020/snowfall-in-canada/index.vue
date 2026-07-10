<script setup>
import data from './data.js'
import colors from '~/assets/colors.js'

definePageMeta({ title: 'Snowfall in Canada', description: 'average monthly snowfall by city' })

// tunables
const max = 72 // shared cm scale across all cities
const chartHeight = 200 // px, per-city chart height

const cities = Object.keys(data)
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="w-full max-w-[800px] col-left">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1>Snowfall in Canada</h1>
    </div>

    <!-- one bar-chart per city, all on the same 0–72cm scale -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-[800px] text-left">
      <div v-for="city in cities" :key="city" class="mt-4 mb-28">
        <div class="city">{{ city }}:</div>
        <div class="chart row" :style="{ height: chartHeight + 'px' }">
          <div class="axis"></div>
          <div v-for="(num, i) in data[city]" :key="i" class="item">
            <div class="bar" :title="num + 'cm'"
              :style="{ backgroundColor: colors.blue, height: (num / max * 100) + '%' }"></div>
            <div class="label" :style="{ color: colors.blue }">{{ months[i] }}</div>
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
/* underlined city label, from the original .slate */
.city {
  color: #8c8c88;
  display: inline;
  margin-left: 1rem;
  border-bottom: 2px solid #8c8c88;
}

/* barchart row — ported from somehow-barchart Vertical.svelte */
.chart {
  margin-top: 10px;
  justify-content: flex-start;
  align-items: flex-start;
  min-height: 50px;
}

.axis {
  height: 90%;
  width: 2px;
  margin-right: 5px;
  background-color: lightgrey;
}

.item {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  text-align: center;
  align-self: stretch;
  padding: 5px;
  box-sizing: border-box;
  width: 8.333%;
  /* each month gets an equal share */
}

.bar {
  align-self: center;
  min-width: 20px;
  width: 100%;
  margin-top: 5px;
  border-radius: 2px;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.bar:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}

.label {
  min-height: 20px;
  max-height: 20px;
  font-size: 12px;
  width: 100%;
  margin-top: 0.5rem;
  text-align: center;
  opacity: 0.7;
}
</style>
