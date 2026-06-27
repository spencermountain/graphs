<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import data from './dst-changes.json'
import colors from '~/assets/colors.js'

definePageMeta({ title: 'DST changes around the world', description: 'spacetime DST lines' })

// data is keyed by timezone name; each has { active, years:[{year,start:"MM-DD",end:"MM-DD",...}] }
const allYears = Object.values(data).flatMap((z) => z.years.map((y) => y.year))
const maxYear = Math.max(...allYears)

// days in a given year (handles leap years)
const yearLen = (yr) => spacetime(`${yr}-12-31`).dayOfYear()
// "MM-DD" in year -> fraction across the year (Jan 1 = 0, Dec 31 = 1)
const frac = (yr, md) => (spacetime(`${yr}-${md}`).dayOfYear() - 1) / (yearLen(yr) - 1)
// "MM-DD" -> "Mar 8"
const label = (yr, md) => spacetime(`${yr}-${md}`).format('{month-short} {date}')

// controls
const year = ref(maxYear) // window end — selector buttons wired later
const span = ref(5) // how many years back to show
const spanOptions = [1, 5, 10, 15, 20]

// active timezones, alphabetical, each with one underline row per year in the window
const zones = computed(() => {
  const lo = year.value - span.value + 1
  const out = []
  for (const name of Object.keys(data).sort((a, b) => a.localeCompare(b))) {
    const z = data[name]
    if (!z.active) continue
    const rows = z.years
      .filter((y) => y.year >= lo && y.year <= year.value && y.start && y.end)
      .sort((a, b) => b.year - a.year) // most recent on top
      .map((y) => ({
        year: y.year,
        start: frac(y.year, y.start),
        end: frac(y.year, y.end),
        startLabel: label(y.year, y.start),
        endLabel: label(y.year, y.end),
      }))
    if (rows.length) out.push({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), rows })
  }
  return out
})

// current place in the year — computed on mount to avoid SSR mismatch
const today = ref(null)
onMounted(() => {
  const now = spacetime.now()
  today.value = (now.dayOfYear() - 1) / (yearLen(now.year()) - 1)
})

const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

// row hover -> show start/end dates in the right gutter (key = "name:year")
const hovered = ref(null)
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-10 px-4 flex justify-center">
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl">
      <h1 class="text-xl font-semibold text-gray-700 mb-4">Daylight-saving changes through the year</h1>

      <!-- span dropdown -->
      <div class="row-left gap-2 mb-5 text-sm text-gray-500">
        <span>Show the last</span>
        <select v-model.number="span" class="border border-gray-200 rounded px-2 py-1 bg-white text-gray-700">
          <option v-for="n in spanOptions" :key="n" :value="n">{{ n }}</option>
        </select>
        <span>{{ span === 1 ? 'year' : 'years' }}</span>
      </div>

      <!-- month scale (aligned to the year track, leaving the right gutter for hover dates) -->
      <div class="row sticky top-0 bg-white z-10 pb-1">
        <div class="relative flex-1 h-4">
          <div v-for="(m, i) in months" :key="i" class="absolute top-0 text-xs text-gray-300 -translate-x-1/2"
            :style="{ left: ((i + 0.5) / 12 * 100) + '%' }">{{ m }}</div>
        </div>
        <div class="w-32 flex-none"></div>
      </div>

      <!-- one group per timezone, with a stack of per-year underline rows -->
      <div v-for="z in zones" :key="z.name" :id="z.slug" class="zone">
        <a :href="'#' + z.slug"
          class="text-base font-medium text-gray-700 mb-0.5 inline-block hover:text-blue-600 hover:underline">{{ z.name
          }}</a>

        <div v-for="r in z.rows" :key="r.year" class="row cursor-default rounded hover:bg-gray-50"
          @mouseenter="hovered = z.name + ':' + r.year" @mouseleave="hovered = null">
          <!-- the year track -->
          <div class="relative flex-1 h-6">
            <!-- baseline across the whole year -->
            <div class="absolute left-0 right-0 bottom-0 h-px bg-gray-100"></div>
            <!-- current-day indicator -->
            <div v-if="today !== null" class="absolute top-0 bottom-0 w-px bg-gray-200"
              :style="{ left: (today * 100) + '%' }"></div>
            <!-- DST span underline, sitting on the bottom of the row -->
            <div class="absolute bottom-0 h-1 rounded-full transition-all"
              :class="hovered === z.name + ':' + r.year ? 'opacity-100' : 'opacity-75'" :style="{
                left: (r.start * 100) + '%',
                width: ((r.end - r.start) * 100) + '%',
                backgroundColor: colors.blue
              }"></div>
            <!-- year inset at Jan 1, resting just above the underline -->
            <div class="absolute left-0 bottom-1 text-xs leading-none text-gray-400 tabular-nums bg-white/80 pr-1">
              {{ r.year }}
            </div>
          </div>
          <!-- right gutter: dates appear on hover -->
          <div class="w-32 flex-none pl-3 text-xs text-gray-500 self-center whitespace-nowrap">
            <span v-if="hovered === z.name + ':' + r.year">
              <span :style="{ color: colors.navy }">{{ r.startLabel }}</span>
              <span class="text-gray-300"> → </span>
              <span :style="{ color: colors.navy }">{{ r.endLabel }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- legend -->
      <div class="row-left gap-4 mt-6 text-[10px] text-gray-400">
        <div class="row-left gap-1">
          <span class="inline-block w-4 h-0.5 rounded-full" :style="{ backgroundColor: colors.blue }"></span>
          DST period
        </div>
        <div class="row-left gap-1">
          <span class="inline-block w-px h-3 bg-gray-300"></span>
          today
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* space between timezones; rows within a zone stay tight to read as one group */
.zone {
  margin-top: 1.4rem;
  scroll-margin-top: 2rem;
}

/* offset so the sticky month bar doesn't cover anchored targets */
</style>
