<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import colors from '~/assets/colors.js'
import layout from './sankey.js'

definePageMeta({ title: `Canada's Budget with CERB benefit`, description: 'in 2020' })

// --- config ---
const height = 800 // px
const nodeWidth = 120 // px
const defaultAccent = '#d98b89' // node underline when no accent given

// billions CAD — three sankey columns: revenue → Canada → spending
const cols = [
  [
    { name: 'Income Tax', to: 'Canada', value: 164, color: 'sea' },
    { name: 'Corporate Tax', to: 'Canada', value: 45, color: 'sea' },
    { name: 'GST', to: 'Canada', value: 37, color: 'sea' },
    { name: 'EI', to: 'Canada', value: 23, color: 'sea' },
    { name: 'Crown', to: 'Canada', value: 12, color: 'sea' },
    { name: 'Customs', to: 'Canada', value: 5, color: 'sea' },
  ],
  [{ name: 'Canada', value: 319, color: 'orange', accent: 'red' }],
  [
    { name: 'CERB', from: 'Canada', value: 62, color: 'red' },
    { name: 'Seniors', from: 'Canada', value: 57, color: 'blue' },
    { name: 'Child services', from: 'Canada', value: 22, color: 'blue' },
    { name: 'Defence', from: 'Canada', value: 25, color: 'blue' },
    { name: 'EI', from: 'Canada', value: 20, color: 'blue' },
    { name: 'Equalization', from: 'Canada', value: 19, color: 'green' },
    { name: 'Health Transfer', from: 'Canada', value: 39, color: 'green' },
    { name: 'Social Transfer', from: 'Canada', value: 14, color: 'green' },
    { name: 'CEBA', from: 'Canada', value: 26, color: 'orange', opacity: 0.5, accent: 'lighter' },
  ],
]

// 164 → '164b' (values are in billions) — ported from the original Post.svelte
const fmt = (num) => {
  num = Number(num) * 1000000000
  if (num >= 1000000000) {
    num = Math.round(num / 100000000) * 100000000
    return String(Math.round(num) / 1000000000) + 'b'
  }
  if (num >= 1000000) {
    num = Math.round(num / 100000) * 100000
    return String(Math.round(num) / 1000000) + 'm'
  }
  if (num > 1000) {
    num = Math.round(num / 10000) * 10000
    return String(num / 1000) + 'k'
  }
  return num
}

const box = ref(null)
const width = ref(500) // re-measured on mount (original used bind:clientWidth)
const nodes = ref([])
const paths = ref([])

// layout mutates its input, so hand it a fresh copy each time
const relayout = () => {
  width.value = box.value.clientWidth
  const items = cols.flatMap((list, col) => list.map((n) => ({ to: '', opacity: 1, ...n, col })))
  const res = layout(items, width.value, height, nodeWidth)
  nodes.value = res.nodes
  paths.value = res.paths
}
onMounted(() => {
  relayout()
  window.addEventListener('resize', relayout)
})
onBeforeUnmount(() => window.removeEventListener('resize', relayout))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Canada's Budget with CERB benefit</h1>
      <div class="text-sm text-gray-400">in 2020</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl">
      <div class="mr-12 my-8">
        <div ref="box" class="relative">
          <!-- node boxes, absolutely positioned above the svg links -->
          <div class="absolute" :style="{ width: width + 'px', height: height + 'px' }">
            <div v-for="d in nodes" :key="d.col + d.name" class="node" :class="{ tiny: d.height < 80 }" :style="{
              left: d.x + 'px',
              top: d.y + 'px',
              width: d.width + 'px',
              height: d.height + 'px',
              borderBottom: '4px solid ' + (colors[d.accent] || d.accent || defaultAccent),
              opacity: d.opacity || 1,
            }">
              <div class="drop" :style="{ width: '100%', height: '100%', backgroundColor: colors[d.color] || d.color }">
              </div>
              <div class="label">{{ d.name }}</div>
              <div class="value" :class="{ tiny: d.height < 80 }" :style="{ color: colors[d.accent] || defaultAccent }">
                {{ fmt(d.value) }}
              </div>
            </div>
          </div>

          <!-- link polygons -->
          <svg :viewBox="`0,0,${width},${height}`" :width="width" :height="height">
            <path v-for="(d, i) in paths" :key="i" class="slink" :d="d" stroke="none" fill="lightsteelblue"
              stroke-width="1" />
          </svg>
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
/* ported from somehow-sankey Sankey.svelte */
.node {
  position: absolute;
  border-radius: 3px;
  box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  color: #dedede;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-family: 'Catamaran', sans-serif;
  transition: box-shadow 0.2s ease-in-out;
}

.node:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}

.slink {
  opacity: 0.2;
}

.value {
  font-size: 25px;
  z-index: 2;
  cursor: default;
}

.label {
  z-index: 2;
  cursor: default;
}

.tiny {
  z-index: 2;
  flex-direction: row;
  font-size: 11px !important;
  justify-content: space-evenly;
}

.drop {
  position: absolute;
  top: 0px;
  z-index: 1;
}
</style>
