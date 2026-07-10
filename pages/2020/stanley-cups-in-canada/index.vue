<script setup>
import { ref, computed, onMounted } from 'vue'
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import data from './data.js'

definePageMeta({ title: 'Stanley Cup wins in Canada', description: 'cup wins by city, 1960 to today' })

// tunables
const height = 700 // px tall
const startYear = '1960'

// group win-years by team
const byTeam = {}
data.forEach((row) => {
  if (row.team) {
    byTeam[row.team] = byTeam[row.team] || []
    byTeam[row.team].push(row.year)
  }
})

// columns, west→east (label colors + dash colors from the original)
const cities = [
  { name: 'Vancouver', team: 'vancouver', labelColor: null, dash: null },
  { name: 'Calgary', team: 'calgary', labelColor: '#d48481', dash: '#d48481' },
  { name: 'Edmonton', team: 'edmonton', labelColor: null, dash: 'silver' },
  { name: 'Winnipeg', team: 'winnipeg', labelColor: null, dash: null },
  { name: 'Toronto', team: 'toronto', labelColor: 'steelblue', dash: colors.blue },
  { name: 'Ottawa', team: 'ottawa', labelColor: null, dash: null },
  { name: 'Montreal', team: 'montreal', labelColor: '#cc7066', dash: colors.red },
  { name: 'Quebec', team: 'quebec', labelColor: null, dash: null },
]

// timeline runs 1960 → 'today'; fixed end for SSR, real today set on mount
const start = spacetime(startYear)
const endEpoch = ref(spacetime('January 1, 2026').epoch)
onMounted(() => {
  endEpoch.value = Date.now()
})

// tiny linear scale, ported from somehow-timeline
const scale = (epoch) => parseInt(((epoch - start.epoch) / (endEpoch.value - start.epoch)) * height, 10)

// decade axis ticks (auto-chosen 'decade' for a 60yr span; underline the century)
const ticks = computed(() => {
  const end = spacetime(endEpoch.value)
  return start.minus(1, 'second').every('decade', end).map((s) => {
    const label = String(s.format('year'))
    return { label, top: scale(s.epoch) - 5, underline: /00$/.test(label) }
  })
})

// each city's dashes, one per cup win
const columns = computed(() =>
  cities.map((c) => ({
    ...c,
    dashes: (c.dash ? byTeam[c.team] || [] : []).map((year) => ({
      year,
      top: scale(spacetime('jan 1 ' + year).epoch),
    })),
  }))
)
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Stanley Cup wins in Canada</h1>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6 w-full" style="max-width: 1200px">
      <div class="m3">
        <div class="timeline" :style="{ height: height + 'px' }">
          <!-- decade axis -->
          <div class="axis">
            <div v-for="t in ticks" :key="t.label" class="tick" :class="{ underline: t.underline }"
              :style="{ top: t.top + 'px' }">{{ t.label }}</div>
          </div>
          <!-- one column per city -->
          <div v-for="c in columns" :key="c.name" class="column">
            <div class="city" :style="c.labelColor ? { color: c.labelColor } : {}">{{ c.name }}</div>
            <div v-for="d in c.dashes" :key="d.year" class="dash" :title="String(d.year)"
              :style="{ top: d.top + 'px', backgroundColor: c.dash }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
      <a class="link" href="https://en.wikipedia.org/wiki/List_of_Stanley_Cup_champions">data</a>
    </div>
  </div>
</template>

<style scoped>
.m3 {
  margin: 3rem;
  text-align: center;
}

/* ported from somehow-timeline: flex row of positioned columns */
.timeline {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  flex-wrap: nowrap;
  text-align: center;
}

.axis {
  position: relative;
  min-width: 50px;
}

.tick {
  position: absolute;
  left: 6px;
  white-space: nowrap;
  text-align: left;
  transform: translate(0px, -8px);
  opacity: 0.5;
  height: 1.3rem;
  font-size: 12px;
  color: #949a9e;
}

.tick.underline {
  border-bottom: 1px solid grey;
  opacity: 1;
}

.column {
  flex: 1;
  position: relative;
  margin: 0 20px;
}

.city {
  font-size: 13px;
  color: #a3a5a5;
}

.dash {
  position: absolute;
  width: 100%;
  min-width: 25px;
  height: 10px;
  border-radius: 2px;
}

@media only screen and (max-width: 900px) {
  .city {
    transform: rotate(290deg) translate(0px, 30px);
    width: 0px;
  }

  .m3 {
    margin: 1rem;
    margin-top: 3rem;
  }
}
</style>
