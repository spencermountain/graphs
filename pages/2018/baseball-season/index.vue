<script setup>
import colors from '~/assets/colors.js'
import teams from './performance.js'
import divisions from './divisions.js'
import { W, H, parseDate, xScale, yScale, monotoneX, xTicks, yTicks } from './somehow.js'

definePageMeta({ title: 'Baseball season, 2018', description: 'games plus/minus .500' })

// line colors, in division order (same list as the original)
const lineColors = ['red', 'green', 'blue', 'pink', 'yellow', 'olive', 'brown', 'purple']

// domains from the original: x 'Mar 20 2018'→'Oct 20 2018', y -35→+35
const x = xScale(parseDate('Mar 20 2018'), parseDate('Oct 20 2018'))
const y = yScale(-35, 35)
const zeroY = y(0) // the .500 line

const ticksX = xTicks(parseDate('Mar 20 2018'), parseDate('Oct 20 2018'), x)
const ticksY = yTicks(-35, 35, y)

// one chart per division: 5 team lines + a name label at each line's end
const charts = Object.keys(divisions).map((key) => {
  const lines = []
  const labels = []
  divisions[key].forEach((team, i) => {
    const color = colors[lineColors[i]] || colors.blue
    const games = teams[team].games.filter((g) => g[1] !== null)
    if (!games.length) return
    const pts = games.map((g) => [x(parseDate(g[0])), y(g[1])])
    lines.push({ team, d: monotoneX(pts), color })
    const last = pts[pts.length - 1]
    // original text dodge: x+2, y+4-(fontSize*1.5)
    labels.push({ team, x: last[0] + 2, y: last[1] + 4 - 15, color })
  })
  return { key, lines, labels }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <div class="col-left w-full" style="max-width: 1040px">
      <!-- header -->
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl text-gray-700 mt-2 ml-4">Baseball season, 2018</h1>
      <div class="text-sm text-gray-400 ml-12 mb-4">games plus/minus .500</div>

      <!-- the six division charts -->
      <div class="bg-white rounded-xl shadow-md p-6 w-full col">
        <svg v-for="c in charts" :key="c.key" viewBox="-85 -10 985 235" preserveAspectRatio="xMidYMid meet"
          class="block w-full h-auto" style="max-width: 985px">
          <!-- x axis -->
          <g>
            <text v-for="t in ticksX" :key="t.pos" :x="t.pos" :y="H + 15" :fill="colors.lighter" text-anchor="middle"
              style="font-size:12px">{{ t.label }}</text>
            <line x1="0" :y1="H" :x2="W" :y2="H" :stroke="colors.lighter" stroke-width="1" />
          </g>
          <!-- y axis -->
          <g>
            <text v-for="t in ticksY" :key="t.pos" x="0" :y="t.pos" dx="-6" dy="0" :fill="colors.lighter"
              text-anchor="end" style="font-size:12px">{{ t.label }}</text>
            <line x1="0" y1="0" x2="0" :y2="H" :stroke="colors.lighter" stroke-width="1" />
          </g>
          <!-- dotted .500 line -->
          <path :d="`M0,${zeroY}L${W},${zeroY}`" fill="none" :stroke="colors.lightgrey" stroke-width="1"
            stroke-dasharray="4" stroke-linecap="round" />
          <!-- team lines -->
          <path v-for="l in c.lines" :key="l.team" :d="l.d" fill="none" :stroke="l.color" stroke-width="2"
            stroke-linecap="round" shape-rendering="optimizeQuality" />
          <!-- division label (left of the plot, at the .500 line) -->
          <g transform="translate(-78 80)">
            <text :fill="colors.olive" style="font-size:16px">
              <tspan x="0" dy="1.2em">{{ c.key }}:</tspan>
            </text>
          </g>
          <!-- team name at each line's end -->
          <g v-for="lb in c.labels" :key="lb.team" :transform="`translate(${lb.x} ${lb.y})`">
            <text :fill="lb.color" style="font-size:10px">
              <tspan x="0" dy="1.2em">{{ lb.team }}</tspan>
            </text>
          </g>
        </svg>
      </div>

      <!-- footer -->
      <div class="mt-8 text-sm text-gray-400 row-center gap-4 self-center">
        <a class="link" href="https://github.com/spencermountain/thensome/2018/05">source</a>
        <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
      </div>
    </div>
  </div>
</template>
