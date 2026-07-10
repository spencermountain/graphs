<script setup>
import spacetime from 'spacetime'
import colors from '~/assets/colors.js'
import data from './data.js'

definePageMeta({ title: 'Governments of Canada', description: 'since confederation' })

// tunables — same values as the original somehow-timeline post
const height = 1400 // px
const start = spacetime('1867')
const end = spacetime('Dec 30 2025')
const margin = 2 // px gap between stacked terms

// tiny linear scale ported from somehow-timeline: epoch → y px (truncated, like the original)
const scale = (epoch) => parseInt(((epoch - start.epoch) / (end.epoch - start.epoch)) * height, 10)

// decade ticks — the old Axis auto-picked 'decade' for a >40yr span; centuries get underlined
const ticks = start.minus(1, 'second').every('decade', end).map((s) => {
  const label = s.format('year')
  return { label, top: scale(s.epoch) - 5, underline: /00$/.test(label) }
})

// one bar per government: Conservatives blue, Liberals red; minority governments faded
const rows = data.map((d) => {
  const top = scale(spacetime(d.start).epoch)
  const bottom = scale(spacetime(d.end).epoch)
  return {
    leader: d.leader || null, // hover tooltip
    top: top + margin,
    height: bottom - top - margin * 2,
    color: d.party === 'Conservative' ? colors.blue : colors.red,
    opacity: d.majority ? 1 : 0.5,
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <div class="w-full max-w-2xl">
      <!-- header -->
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-light text-gray-700 mt-2">Governments of Canada</h1>
      <div class="text-gray-400 mb-4">since confederation</div>

      <!-- the graphic -->
      <div class="bg-white rounded-xl shadow-md p-6">
        <div class="timeline" :style="{ height: height + 'px' }">
          <!-- year axis -->
          <div class="axis">
            <div v-for="t in ticks" :key="t.label" class="tick" :class="{ century: t.underline }"
              :style="{ top: t.top + 'px' }">{{ t.label }}</div>
          </div>
          <!-- one line per government -->
          <div class="column">
            <div v-for="(r, i) in rows" :key="i" class="gov" :title="r.leader"
              :style="{ top: r.top + 'px', height: r.height + 'px', opacity: r.opacity }">
              <div class="line" :style="{ backgroundColor: r.color }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- footer -->
      <div class="mt-8 text-sm text-gray-400 row-center gap-4">
        <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* layout ported from somehow-timeline's Timeline/Axis/Column/Line svelte components */
.timeline {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
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

.century {
  border-bottom: 1px solid grey;
  opacity: 1;
}

.column {
  flex: 1;
  position: relative;
  margin: 0 20px;
  max-width: 400px;
  /* original forced min-width:400px; allow shrinking on small screens */
  min-width: 0;
}

.gov {
  position: absolute;
  width: 100%;
  border-radius: 5px;
}

.line {
  height: 100%;
  width: 100%;
  cursor: default;
  border-radius: 3px;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
}

.line:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}
</style>
