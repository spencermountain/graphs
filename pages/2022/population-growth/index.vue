<script setup>
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import data from './by-mayor.js'
import { monotoneArea } from './shape.js'

definePageMeta({ title: 'Toronto Population growth', description: 'population by mayoral term, 1966–2030' })

// the 'yukon' color combo from the original — '' keeps the data file's color
const combo = ['sky', 'beige', 'red', '#978BA3', '#8C8C88', '', '#cc6966', 'blue', '', '#2D85A8']
const terms = data.map((o, i) => ({ ...o, color: colors[combo[i]] || combo[i] || o.color }))

// tiny scaleLinear, from the original lib/scale.js (integer truncation kept)
const scale = ({ world, minmax }, num) => {
  let percent = (num - minmax[0]) / (minmax[1] - minmax[0])
  return parseInt((world[1] - world[0]) * percent, 10)
}

const max = 3000000
const min = terms[0].points[0].y
const start = spacetime(terms[0].points[0].x + '-01-01') // 1966
const end = spacetime('2030-01-01')

const xEpoch = (e) => scale({ world: [0, 100], minmax: [start.epoch, end.epoch] }, e)
const xScale = (str) => xEpoch(spacetime(String(str)).epoch)
const yScale = (n) => scale({ world: [0, 100], minmax: [max, min] }, n) // reversed

const todayX = xScale('October 24, 2022') // election day

// each term is a filled 'triangle': its growth curve, extended flat to today
// (or to 2030 for the projections), down to its starting population. drawn in order, so later terms overlap
const shapes = terms.map((term) => {
  const last = term.points[term.points.length - 1]
  const pts = [...term.points, { x: term.future ? 'December 31, 2030' : 'October 18, 2022', y: last.y }]
  const y0 = yScale(term.points[0].y)
  return {
    d: monotoneArea(pts.map((p) => ({ x: xScale(p.x), y0, y1: yScale(p.y) }))),
    fill: term.color || 'lightgrey',
  }
})

// dashed trend line — the original's x1 was xScale(2000000), an unparsable
// date that fell back to epoch-0 (≈1970). kept as-is.
const trend = { x1: xEpoch(0), y1: yScale(terms[0].points[0].y), x2: xScale('2030'), y2: yScale(3000000) }

const xTicks = ['1970-01-01', '1980-01-01', '1990-01-01', '2000-01-01', '2010-01-01', '2020-01-01']
const yTicks = [2000000, 2500000, 3000000]
const fmt = (n) => (n / 1000000).toLocaleString() + 'm'
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1>Toronto Population growth</h1>

    <div class="bg-white rounded-xl shadow-md p-6 w-[90%] max-w-[1500px]">
      <div class="chart-wrap">
        <div class="chart">
          <div class="top-stat">3 million<br />by 2031<br />*</div>

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
            <path v-for="(s, i) in shapes" :key="i" :d="s.d" :fill="s.fill" stroke="none"
              shape-rendering="geometricPrecision" />
            <line :x1="trend.x1" :y1="trend.y1" :x2="trend.x2" :y2="trend.y2" stroke-width="0.5%" stroke="grey"
              stroke-dasharray="1" />
          </svg>

          <!-- x axis -->
          <div class="bottom">
            <div v-for="str in xTicks" :key="str" class="tick-x" :style="{ left: xScale(str) + '%' }">
              {{ str.slice(0, 4) }}</div>
          </div>
          <!-- y axis -->
          <div class="left-axis">
            <div v-for="n in yTicks" :key="n" class="tick-y" :style="{ top: yScale(n) + '%' }">{{ fmt(n) }}</div>
          </div>

          <!-- dashed 'today' line -->
          <div class="today" :style="{ left: todayX + 0.3 + '%' }"></div>
          <!-- mayor names, stacked beside today at each term's mid population -->
          <div v-for="(term, i) in terms" :key="i" v-show="term.mayor" class="mayor"
            :style="{ color: term.color, left: todayX + 2 + '%', top: yScale(term.mid) + '%' }">
            {{ term.mayor }}
          </div>
        </div>
      </div>
    </div>

    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* room for the axes + labels that hang outside the container */
.chart-wrap {
  margin: 3.5rem;
  margin-top: 4.5rem;
}

.chart {
  position: relative;
  aspect-ratio: 1.618/1;
  /* golden */
}

svg {
  overflow: visible;
  position: relative;
}

.top-stat {
  font-size: 15px;
  color: grey;
  right: -40px;
  position: absolute;
  top: -55px;
  line-height: 1.2rem;
}

.today {
  height: 80%;
  position: absolute;
  top: 18%;
  border-left: 2px dashed grey;
}

.mayor {
  position: absolute;
  font-size: 18px;
  color: grey;
}

/* x axis */
.bottom {
  height: 25px;
  left: 0px;
  width: 100%;
  border-top: 1px solid lightgrey;
  position: absolute;
  bottom: -25px;
}

.tick-x {
  position: absolute;
  bottom: 0%;
  color: grey;
  font-size: 14px;
}

/* y axis */
.left-axis {
  position: absolute;
  top: 0px;
  height: 100%;
  width: 40px;
  left: -45px;
  padding-right: 5px;
  border-right: 1px solid lightgrey;
  text-align: right;
}

.tick-y {
  text-align: right;
  width: 35px;
  position: absolute;
  color: grey;
  font-size: 16px;
  height: 16px;
  margin-top: -16px;
}

@media only screen and (max-width: 700px) {
  .mayor {
    font-size: 11px;
  }

  .chart-wrap {
    margin: 1.5rem;
    margin-top: 3rem;
  }
}

@media only screen and (max-width: 400px) {
  .tick-x {
    display: none;
  }
}
</style>
