<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import PlusMinus from './PlusMinus.vue'

definePageMeta({ title: 'Break-up the year', description: 'divide a year into equal pieces' })

// piece colors — the old spencer-color combos: ken + dupont + bloor, in order
const pieceColors = [
  colors.red, colors.sky, '#c67a53', colors.greygreen, '#dfb59f', colors.mud, // ken
  colors.green, colors.brown, colors.orange, colors.red, colors.olive, colors.blue, // dupont
  colors.night, colors.navy, colors.beige, colors.rouge, colors.mud, colors.grey, // bloor
]

// controls
const pieces = ref(4)
const year = ref(2026) // updated to the current year on mount (SSR-safe)
onMounted(() => { year.value = spacetime.now().year() })

// split the year's epoch-span into n equal pieces (port of old compute.js)
const parts = computed(() => {
  const n = Math.floor(pieces.value)
  if (!n || n < 1) return []
  const start = spacetime.now().year(year.value).startOf('year')
  const end = spacetime.now().year(year.value).endOf('year')
  const step = (end.epoch - start.epoch) / n
  return Array.from({ length: n }, (_, i) => spacetime(start.epoch + step * i))
})

// colored date-ranges, replicating old makeCalendar + sometime's Calendar.color()
const ranges = computed(() => {
  const list = parts.value
  return list.map((s0, i) => {
    let s = s0.startOf('day')
    if (i === 0) s = s.minus(1, 'minute') // so jan 1st itself gets colored
    const end = list[i + 1] || s.endOf('year')
    return { start: s.startOf('day').epoch, end: end.endOf('day').epoch, color: pieceColors[i] }
  })
})

// last matching range wins (old code applied styles in order, overwriting)
const dayColor = (epoch, rs) => {
  let color = null
  rs.forEach((r) => {
    if (epoch > r.start && epoch < r.end && r.color !== undefined) color = r.color
  })
  return color
}

// 6 monday-start weeks for one month; days outside the month are blank stubs
const monthGrid = (m0, rs) => {
  const monthNum = m0.month()
  let d = m0.startOf('week')
  const weeks = []
  for (let w = 0; w < 6; w += 1) {
    const days = []
    for (let i = 0; i < 7; i += 1) {
      const stub = d.month() !== monthNum
      days.push({
        stub,
        num: stub ? '' : d.date(),
        title: stub ? '' : d.format('{month-short} {date}'),
        color: stub ? null : dayColor(d.epoch, rs),
      })
      d = d.add(1, 'day')
    }
    weeks.push(days)
  }
  return weeks
}

// 4 quarters × 3 months (port of sometime's year.ByQuarter)
const calendar = computed(() => {
  const rs = ranges.value
  let d = spacetime.now().year(year.value).startOf('year')
  const quarters = []
  for (let q = 0; q < 4; q += 1) {
    const months = []
    for (let m = 0; m < 3; m += 1) {
      months.push({ label: d.format('month-short'), weeks: monthGrid(d, rs) })
      d = d.add(1, 'month')
    }
    quarters.push(months)
  }
  return quarters
})

// underlined date list, e.g. "apr 2nd, 6:00am"
const dateList = computed(() =>
  parts.value.map((s, i) => ({ label: s.format('nice'), color: pieceColors[i] })))

// inline day styles, matching the old sometime day cells
const dayStyle = (day) => {
  if (day.stub) return { backgroundColor: colors.white, border: '1px solid transparent' }
  const st = { color: colors.lighter, border: `1px solid ${colors.lighter}` }
  if (day.color) {
    st.backgroundColor = day.color
    st.border = `1px solid ${day.color}`
  }
  return st
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="w-full max-w-[45rem]">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="ml-0">Break-up the year</h1>
      <div class="text-gray-400 mb-4">divide a year into equal pieces</div>
    </div>

    <!-- controls, right-aligned above the card like the original -->
    <div class="w-full max-w-[45rem] row-right gap-8 mb-3">
      <div>
        <div :style="{ color: colors.grey }">year</div>
        <PlusMinus v-model="year" />
      </div>
      <div>
        <div :style="{ color: colors.grey }">pieces</div>
        <PlusMinus v-model="pieces" />
      </div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-[45rem]">
      <div class="flex flex-row flex-wrap justify-center items-center text-center">
        <!-- calendar, by quarter -->
        <div class="mr-8 max-w-96">
          <div class="text-right text-[0.8rem]" :style="{ color: colors.grey }">{{ year }}</div>
          <div v-for="(qtr, qi) in calendar" :key="qi" class="flex flex-row justify-around my-4">
            <div v-for="(m, mi) in qtr" :key="mi">
              <div class="text-[0.9rem]" :style="{ color: colors.grey }">{{ m.label }}</div>
              <div class="w-32 text-left">
                <div v-for="(week, wi) in m.weeks" :key="wi" class="flex flex-row flex-nowrap w-full">
                  <div v-for="(day, di) in week" :key="di" class="day" :title="day.title" :style="dayStyle(day)">
                    {{ day.num }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- date list -->
        <div class="ml-8 col-left text-left" :style="{ color: colors.grey }">
          <div v-for="(item, i) in dateList" :key="i" class="m-4">
            {{ i + 1 }})
            <span :style="item.color ? { borderBottom: '3px solid ' + item.color } : {}">{{ item.label }}</span>
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
/* day cells: squares via padding-bottom, tiny light date numbers (as in old sometime) */
.day {
  flex: 1 1 0;
  overflow: hidden;
  margin: auto;
  height: 0;
  min-height: 0;
  padding-bottom: 10%;
  font-size: 8px;
}
</style>
