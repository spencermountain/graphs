<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import colors from '~/assets/colors.js'
import layout from './sankey.js'

definePageMeta({ title: "Canada's Population on CERB benefit", description: 'in 2020' })

// tunables — same numbers as the 2020 post (values in millions)
const height = 750 // px
const nodeWidth = 120 // px
const accent = '#d98b89' // default underline + value-text color
const cols = [
  [
    { name: 'CERB', to: 'Working Age', value: 8.5, color: 'red' },
    { name: 'CPP/OAS', to: 'Retired', value: 6.5, color: 'blue' },
  ],
  [
    { name: 'Young', to: 'Canada', value: 8, color: 'blue' },
    { name: 'Working Age', to: 'Canada', value: 22, color: 'sky' },
    { name: 'Retired', to: 'Canada', value: 6.5, color: 'blue' },
  ],
  [{ name: 'Canada', value: 30, color: 'orange', accent: 'red' }],
]

// millions → '8.5m' / '1.2b', rounded like the original fmt
const fmt = (num) => {
  num = Number(num) * 1000000
  if (num >= 1e9) return String((Math.round(num / 1e8) * 1e8) / 1e9) + 'b'
  if (num >= 1e6) return String((Math.round(num / 1e5) * 1e5) / 1e6) + 'm'
  if (num > 1000) return String((Math.round(num / 1e4) * 1e4) / 1000) + 'k'
  return num
}

// layout needs a real pixel width — measure on mount (page is prerendered)
const el = ref(null)
const width = ref(500)
const nodes = ref([])
const paths = ref([])
const doLayout = () => {
  width.value = el.value.clientWidth
  const res = layout(cols, width.value, height, nodeWidth)
  nodes.value = res.nodes
  paths.value = res.paths
}
onMounted(() => {
  doLayout()
  window.addEventListener('resize', doLayout)
})
onUnmounted(() => window.removeEventListener('resize', doLayout))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <div class="w-full max-w-5xl">
      <!-- header -->
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-light text-gray-700 mt-2">Canada's Population on CERB benefit</h1>
      <div class="text-gray-400 mb-4">in 2020</div>

      <!-- the graphic -->
      <div class="bg-white rounded-xl shadow-md p-6">
        <div ref="el" class="relative my-6">
          <!-- link ribbons -->
          <svg :viewBox="`0,0,${width},${height}`" :width="width" :height="height">
            <path v-for="(d, i) in paths" :key="i" class="ribbon" :d="d" fill="lightsteelblue" stroke="none" />
          </svg>
          <!-- nodes -->
          <div class="absolute inset-0">
            <div v-for="d in nodes" :key="d.name" class="node" :style="{
              left: d.x + 'px', top: d.y + 'px', width: d.width + 'px', height: d.height + 'px',
              backgroundColor: colors[d.color] || d.color,
              borderBottom: '4px solid ' + (colors[d.accent] || d.accent || accent),
            }">
              <div class="label">{{ d.name }}</div>
              <div class="value" :style="{ color: accent }">{{ fmt(d.value) }}</div>
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
/* node + ribbon styles ported from somehow-sankey */
.node {
  position: absolute;
  border-radius: 3px;
  box-shadow: 1px 2px 8px 0px grey;
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

.label {
  cursor: default;
  line-height: 1rem;
}

.value {
  font-size: 20px;
  font-weight: 100;
  cursor: default;
}

.ribbon {
  opacity: 0.2;
}
</style>
