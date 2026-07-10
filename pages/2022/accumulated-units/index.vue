<script setup>
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import scale from './scale.js'
import XAxis from './XAxis.vue'
import YAxis from './YAxis.vue'
import data from './data.js'

definePageMeta({ title: 'Accumulated growth in Toronto', description: 'housing units added each term' })

// tunables — y-domain max was hand-tuned in the original
const max = 158382 + 10458 - 35000
const min = 0
const start = spacetime('2007-01-01')
const end = spacetime('2023-01-01')

// accumulate running totals onto each year (idempotent)
let sum = 0
let sumApproved = 0
data.forEach((o) => {
  o.already = sum
  o.already_approved = sumApproved
  sum += o.total
  sumApproved += o.approvals
})

// units built during each 4-year mayoral term
const t1 = data[0].total + data[1].total + data[2].total + data[3].total
const t2 = data[4].total + data[5].total + data[6].total + data[7].total
const t3 = data[8].total + data[9].total + data[10].total + data[11].total
const t4 = data[12].total + data[13].total + data[14].total + data[15].total

const xScale = (str) =>
  scale({ world: [0, 100], minmax: [start.epoch, end.epoch] }, spacetime(String(str)).epoch)
const yScale = (n) => scale({ world: [0, 100], minmax: [min, max] }, n)
const yTicks = [t1, t1 + t2, t1 + t2 + t3, t1 + t2 + t3 + t4]
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1>Accumulated growth in Toronto</h1>
      <div class="text-gray-400 ml-4">housing units added each term</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6 w-full max-w-7xl overflow-x-auto">
      <div class="center" style="min-width: 900px">
        <div class="chart-container chart-row">
          <!-- stacked pairs: built (blue) + approved (lightsteelblue), each resting on the built running-total -->
          <div v-for="o in data" :key="o.year" class="group" style="height: 100%">
            <div
              class="bar"
              :style="{
                height: yScale(o.total) + '%',
                bottom: yScale(o.already) + '%',
                backgroundColor: colors.blue,
              }"
            />
            <div
              class="bar"
              :style="{ height: yScale(o.approvals) + '%', bottom: yScale(o.already) + '%', left: '50%' }"
            />
          </div>

          <!-- dashed vertical lines on election days -->
          <div class="today" :style="{ marginLeft: '17px', left: xScale('October 25, 2010') + '%' }" />
          <div class="today" :style="{ marginLeft: '17px', left: xScale('October 27, 2014') + '%' }" />
          <div class="today" :style="{ marginLeft: '17px', left: xScale('October 22, 2018') + '%' }" />

          <!-- dashed horizontal lines: cumulative built by end of each term (small hand-tuned nudges from the original) -->
          <div class="total" :style="{ width: xScale('October 25, 2010') - 5 + '%', bottom: yScale(t1) + '%' }" />
          <div class="total" :style="{ width: xScale('October 27, 2014') - 5 + '%', bottom: yScale(t1 + t2) - 0.5 + '%' }" />
          <div class="total" :style="{ width: xScale('October 22, 2018') - 5 + '%', bottom: yScale(t1 + t2 + t3) - 0.9 + '%' }" />
          <div class="total" :style="{ width: xScale('October 22, 2022') - 5 + '%', bottom: yScale(t1 + t2 + t3 + t4) - 1.5 + '%' }" />

          <XAxis :x-scale="xScale" />
          <YAxis :y-scale="yScale" :ticks="yTicks" />

          <!-- mayoral term labels -->
          <div class="chart-row bars">
            <div class="term col" style="border-top: 2px solid lightgrey">Miller #2</div>
            <div class="term col" style="border-top: 2px solid lightgrey">Ford</div>
            <div class="term col" style="border-top: 2px solid lightgrey">Tory #1</div>
            <div class="term col" style="border-top: 2px solid lightgrey">Tory #2</div>
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
.bars {
  position: absolute;
  width: 100%;
  color: grey;
  bottom: -55px;
}
.term {
  color: grey;
  padding: 0.3rem;
  font-size: 11px;
  line-height: 15px;
  font-weight: 100;
  flex: 1;
  margin-top: 15px;
  margin-bottom: 5px;
  margin-left: 27px;
  margin-right: 27px;
  height: 20px;
  display: inline-block;
  opacity: 0.8;
}
.today {
  height: 80%;
  position: absolute;
  top: 18%;
  border-left: 2px dashed lightgrey;
  margin-left: 12px;
}
.total {
  position: absolute;
  left: 0px;
  height: 2px;
  border-top: 2px dashed grey;
  margin-left: 12px;
}
.chart-row {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  text-align: center;
  flex-wrap: nowrap;
  align-self: stretch;
}
.group {
  flex: 1;
  margin: 10px;
  position: relative;
}
.bar {
  flex: 1;
  width: 50%;
  background-color: lightsteelblue;
  position: absolute;
  border-radius: 2px;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}
.center {
  text-align: center;
}
.chart-container {
  position: relative;
  max-width: 1400px;
  min-width: 400px;
  margin: 3rem;
  margin-top: 1rem;
  margin-bottom: 4rem; /* clearance for the axes/labels hanging 55px below */
  aspect-ratio: 1.618/1; /* golden */
}
</style>
