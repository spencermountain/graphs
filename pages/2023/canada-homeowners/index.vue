<script setup>
import { ref } from 'vue'
import data from './data.js'
import color from './color.js'

definePageMeta({ title: 'Home ownership in canada', description: 'population and home-ownership rate, by age group' })

// config
const chartHeight = '230px'
const popMax = 4288365 // fixed y-max of the population chart
const rateMax = 1.2 // fixed y-max of the ownership-rate chart

const selected = ref(10) // hovered/clicked age group

const percent = (part, total) => Math.round((part / total) * 1000) / 10
const intOf = (n) => parseInt(n, 10)

// width % of the right-aligned overlay line — spans bars at-or-above the selected age
const lineX = (n) => percent(data.length - n, data.length) - 2

// bar geometry — equal widths, height % against a fixed max
const share = (1 / data.length) * 100
const size = (val, max) => (val / max) * 100

const barColor = (age) => color(age.rate)
// 'notWhite' behavior from somehow-barchart: white bars get a legible grey label
const labelColor = (age) => (color(age.rate) === '#ffffff' ? 'lightgrey' : color(age.rate))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-2">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl text-gray-700 mt-2">Home ownership in canada</h1>
    </div>

    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-3xl">
      <!-- population by age group, coloured by ownership rate -->
      <div class="graph">
        <div class="label">population</div>
        <div class="total" :style="{ width: lineX(selected) + '%' }">
          &nbsp; &nbsp;{{ intOf(data[selected].percentage) }}%
          <span class="smol">population:</span>
          <div class="tick">|</div>
        </div>
        <div class="chart" :style="{ height: chartHeight }">
          <div class="axis"></div>
          <div v-for="(age, i) in data" :key="i" class="item"
            :style="{ maxWidth: share + '%', minWidth: share + '%' }">
            <div class="show"></div>
            <div class="bar" :style="{ backgroundColor: barColor(age), height: size(age.total, popMax) + '%' }"
              @mouseenter="selected = i" @click="selected = i"></div>
            <div class="lbl" :style="{ color: labelColor(age) }">{{ age.label.split(' ')[0] }}</div>
          </div>
        </div>
      </div>

      <!-- ownership rate by age group -->
      <div class="graph">
        <div class="label">home ownership rate:</div>
        <div class="total" :style="{ width: lineX(selected) + '%' }">
          &nbsp; &nbsp;{{ intOf(data[selected].cumulative) }}% <span class="smol">houses</span>
          <div class="tick">|</div>
        </div>
        <div class="chart" :style="{ height: chartHeight }">
          <div class="axis"></div>
          <div v-for="(age, i) in data" :key="i" class="item"
            :style="{ maxWidth: share + '%', minWidth: share + '%' }">
            <div class="show" :style="{ color: barColor(age) }">{{ intOf(age.rate * 100) }}%</div>
            <div class="bar" :title="String(age.start)"
              :style="{ backgroundColor: barColor(age), height: size(age.rate, rateMax) + '%' }"
              @mouseenter="selected = i" @click="selected = i"></div>
            <div class="lbl" :style="{ color: labelColor(age) }">{{ age.label.split(' ')[0] }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://www150.statcan.gc.ca/n1/daily-quotidien/220921/dq220921b-eng.htm">statcan</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* post layout (from the original Post.svelte) */
.graph {
  margin: 4rem 2rem 10rem;
  position: relative;
}

.label {
  text-align: left;
  height: 4rem;
}

.total {
  position: absolute;
  right: 0px;
  top: 4rem;
  border-bottom: 1px solid lightgrey;
  color: grey;
}

.tick {
  position: absolute;
  left: -5px;
  top: 13px;
  color: lightgrey;
}

.smol {
  font-size: 0.8rem;
  color: grey;
  margin-left: 0.3rem;
}

/* barchart (ported from somehow-barchart Vertical.svelte) */
.chart {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: flex-start;
  flex-wrap: nowrap;
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
  flex-wrap: nowrap;
  align-self: stretch;
  padding: 5px;
  box-sizing: border-box;
}

.show,
.lbl {
  color: #a6a4a4;
  min-height: 20px;
  max-height: 20px;
  font-size: 12px;
  width: 100%;
  flex: 1;
  margin-top: 0.5rem;
  text-align: center;
  opacity: 0.7;
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
</style>
