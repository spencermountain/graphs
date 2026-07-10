<script setup>
import { ref, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import data from './data.js'

definePageMeta({ title: 'Daylight Savings change dates, in 2020', description: "'Eastern Standard' time" })

// --- config ---
const year = 2020 // original plotted 'the current year'; pinned to match the title
const height = 900 // px, timeline height
// spencer-color 'roma' combo, as the original used
const roma = ['#8a849a', '#b5b0bf', colors.rose, colors.lighter, colors.greygreen, colors.mud]

// y-scale: Jan 1 → 0px, Dec 31 → height px (somehow-timeline's linear scale)
const jan1 = spacetime(`${year}-01-01`)
const range = spacetime(`${year}-12-31`).epoch - jan1.epoch
const yOf = (s) => Math.round(((s.epoch - jan1.epoch) / range) * height)
const yMD = (md) => yOf(spacetime(`${year}-${md.replace('/', '-')}`)) // '03/29' → px

// month labels down the left side
const ticks = Array.from({ length: 12 }, (_, i) => {
  const s = jan1.add(i, 'month')
  return { y: yOf(s), label: s.format('{month-short}') }
})

// color zones in data-order (like the original did), then sort by utc-offset
let zones = data.map((zone, i) => ({ ...zone, offset: Number(zone.offset), color: roma[i % 6] }))
zones.sort((a, b) => b.offset - a.offset)
const negatives = zones.filter((z) => z.offset < 0) // western hemisphere
const positives = zones.filter((z) => z.offset >= 0).reverse() // eastern hemisphere

// z.already = column-index where this offset-group starts; returns total column count
const addAlready = (arr) => {
  let n = 0
  arr.forEach((z) => {
    z.already = n
    z.times.forEach((t) => (n += t.zones.length))
  })
  return n
}
const westN = addAlready(negatives)
const eastN = addAlready(positives)

// one thin vertical bar per timezone-city
const flatten = (arr) =>
  arr.flatMap((z) =>
    z.times.flatMap((t) =>
      t.zones.map((name) => {
        const top = yMD(t.start)
        const bottom = yMD(t.end)
        return { name, color: z.color, top: top + 2, h: Math.max(bottom - top - 4, 0) }
      })
    )
  )

// small '-4h'-style label above each integer-offset group
const offsetLabels = (arr, md, span) =>
  arr
    .filter((z) => Number.isInteger(z.offset))
    .map((z) => ({ label: z.offset + 'h', color: z.color, col: z.already, span, y: yMD(md) }))

// timezone-name labels — the original hand-placed these in px (13px/col west, 10px/col east);
// re-anchored to column units so they line up at any container width
const westNames = [
  { label: 'Atlantic', color: colors.rose, col: 3.8, span: 3.8 },
  { label: 'Eastern', color: colors.greygreen, col: 15.4, span: 3.8 },
  { label: 'Central', color: colors.mud, col: 36.2, span: 11.5 },
  { label: 'Mountain', color: '#8a849a', col: 53.8, span: 5.4 },
  { label: 'Pacific', color: '#b5b0bf', col: 68.5, span: 2.3 },
].map((o) => ({ ...o, y: yMD('02/20') }))
const eastNames = [
  { label: 'GMT', color: colors.greygreen, col: 10, span: 6 },
  { label: 'CET', color: colors.rose, col: 20, span: 16 },
  { label: 'EET', color: colors.lighter, col: 50, span: 9 },
].map((o) => ({ ...o, y: yMD('03/20') }))

const hemis = [
  {
    title: 'Western Hemisphere',
    sub: '(North/South America)',
    cols: flatten(negatives),
    n: westN,
    labels: [...westNames, ...offsetLabels(negatives, '03/07', 2.3)],
    barW: 8,
    gap: 0,
  },
  {
    title: 'Eastern Hemisphere',
    sub: '(Asia/Africa)',
    cols: flatten(positives),
    n: eastN,
    labels: [...eastNames, ...offsetLabels(positives, '04/10', 3)],
    barW: 6,
    gap: 2,
  },
]

// today's dashed pink line, mapped into the plotted year — on mount to stay SSR-safe
const todayY = ref(null)
onMounted(() => {
  const now = spacetime.now()
  todayY.value = Math.round(((now.dayOfYear() - 1) / 365) * height)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Daylight Savings change dates, in 2020</h1>
      <div class="text-sm text-gray-400">'Eastern Standard' time</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-6xl overflow-x-auto">
      <div v-for="(h, hi) in hemis" :key="h.title" :class="{ 'mt-12': hi > 0 }" class="text-center">
        <div class="text-gray-700">{{ h.title }}</div>
        <div class="sub">{{ h.sub }}</div>

        <div class="timeline flex" :style="{ height: height + 'px' }">
          <!-- today's dashed line -->
          <div v-if="todayY !== null" class="now" :style="{ top: todayY + 'px' }"></div>

          <!-- month ticks -->
          <div class="relative w-10 flex-none">
            <div v-for="t in ticks" :key="t.label" class="tick" :style="{ top: t.y + 'px' }">{{ t.label }}</div>
          </div>

          <div class="relative flex-1">
            <!-- one bar per timezone-city -->
            <div class="row h-full">
              <div v-for="(c, i) in h.cols" :key="i" class="relative h-full"
                :style="{ minWidth: h.barW + 'px', maxWidth: h.barW + 'px', margin: '0 ' + h.gap + 'px' }">
                <div class="bar" :title="c.name"
                  :style="{ top: c.top + 'px', height: c.h + 'px', backgroundColor: c.color }"></div>
              </div>
            </div>

            <!-- underlined group labels -->
            <div v-for="lb in h.labels" :key="lb.label + lb.col" class="wide" :style="{
              top: lb.y + 'px',
              left: (lb.col / h.n) * 100 + '%',
              width: (lb.span / h.n) * 100 + '%',
              color: lb.color,
              borderBottom: '1px solid ' + lb.color,
            }">{{ lb.label }}</div>
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
.timeline {
  position: relative;
  margin: 1rem 0;
  min-width: 1050px;
  /* east hemisphere needs ~1030px of columns */
}

.tick {
  position: absolute;
  padding: 0 4px;
  white-space: nowrap;
  text-align: left;
  font-size: 12px;
  color: #838B91;
  opacity: 0.6;
  transform: translate(0px, -8px);
}

.bar {
  position: absolute;
  left: 0;
  width: 100%;
  border-radius: 3px;
  opacity: 0.7;
  cursor: default;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.bar:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}

.now {
  position: absolute;
  left: 0;
  right: 0;
  border-bottom: 2px dashed #F2C0BB;
  /* spencer-color pink */
}

.wide {
  position: absolute;
  min-height: 3px;
  font-size: 0.8rem;
  text-align: right;
}

.sub {
  color: #d1d1d1;
}
</style>
