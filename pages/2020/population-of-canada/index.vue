<script setup>
import { ref, onMounted } from 'vue'
import colors from '~/assets/colors.js'
import layout from './sankey.js'

definePageMeta({ title: 'Population of Canada', description: 'by metro area, from Wikipedia' })

// tunables (from the original Post.svelte / somehow-sankey defaults)
const height = 1100
const nodeWidth = 120
const accent = '#d98b89' // node underline + number color

// data — metro areas → provinces → Canada, in millions (from Wikipedia)
const cols = [
  [
    { name: 'Greater Toronto', to: 'Ontario', value: 6, color: 'sky' },
    { name: 'Ottawa', to: 'Ontario', value: 1, color: 'sky' },
    { name: 'Greater Montreal', to: 'Quebec', value: 4, color: 'mud' },
    { name: 'Greater Vancouver', to: 'B.C.', value: 2.4, color: 'burn' },
    { name: 'Calgary', to: 'Alberta', value: 1.3, color: 'greygreen' },
  ],
  [
    { name: 'Ontario', to: 'Canada', value: 14, color: 'sky' },
    { name: 'Quebec', to: 'Canada', value: 8, color: 'mud' },
    { name: 'B.C.', to: 'Canada', value: 5, color: 'burn' },
    { name: 'Alberta', to: 'Canada', value: 4, color: 'greygreen' },
    { name: 'Nova Scota', to: 'Canada', value: 1 },
    { name: 'Manitoba', to: 'Canada', value: 1 },
    { name: 'Saskatchewan', to: 'Canada', value: 1 },
  ],
  [{ name: 'Canada', color: 'red' }],
]

// fill-in the old <Node> component defaults
const items = cols.flatMap((nodes, i) =>
  nodes.map((d) => ({
    to: '',
    ...d,
    value: Number(d.value) || 0,
    color: colors[d.color] || d.color || 'steelblue',
    stroke: accent,
    accent,
    full: 100,
    opacity: 1,
    dx: 0,
    dy: 0,
    col: i + 1,
  }))
)

// values are in millions — round to nearest 100k
const fmt = (num) => {
  num = Number(num) * 1000000
  if (num >= 1000000) {
    num = Math.round(num / 100000) * 100000
    return String(num / 1000000) + 'm'
  }
  if (num > 1000) {
    num = Math.round(num / 10000) * 10000
    return String(num / 1000) + 'k'
  }
  return num
}

// layout runs client-side, with the measured container width (like the original onMount)
const el = ref(null)
const width = ref(500)
const nodes = ref([])
const paths = ref([])
onMounted(() => {
  width.value = el.value.clientWidth
  const res = layout(items, width.value, height, nodeWidth)
  nodes.value = res.nodes
  paths.value = res.paths
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="w-full max-w-5xl col-left">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1>Population of Canada</h1>
      <div class="ml-4 text-gray-400">by metro area, from Wikipedia</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 mt-6 w-full max-w-5xl">
      <div class="m3">
        <div ref="el" class="relative">
          <div class="absolute" :style="{ width: width + 'px', height: height + 'px' }">
            <div v-for="d in nodes" :key="d.name" class="node" :class="{ tiny: d.height < 75 }" :title="d.name" :style="{
              left: d.x + 'px',
              top: d.y + 'px',
              width: d.width + 'px',
              height: d.height + 'px',
              opacity: d.opacity,
            }">
              <div class="drop" :style="{ width: '100%', height: d.full + '%', backgroundColor: d.color, borderBottom: '4px solid ' + d.accent }">
              </div>
              <div class="label">{{ d.name }}</div>
              <div class="value" :class="{ tiny: d.height < 75 }" :style="{ color: d.stroke }">{{ fmt(d.value) }}</div>
            </div>
          </div>
          <svg :viewBox="`0,0,${width},${height}`" :width="width" :height="height">
            <path v-for="(d, i) in paths" :key="i" class="ribbon" :d="d" stroke="none" fill="lightsteelblue" />
          </svg>
        </div>
      </div>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://en.wikipedia.org/wiki/Metropolitan_area">data</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* node + link styles from the original somehow-sankey */
.node {
  position: absolute;
  border-radius: 3px;
  color: #dedede;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 4px solid #d98b89;
  font-size: 15px;
  font-family: 'Catamaran', sans-serif;
  transition: box-shadow 0.2s ease-in-out;
  box-shadow: 1px 2px 8px 0px grey;
}

.node:hover {
  box-shadow: 2px 2px 8px 0px steelblue;
}

.ribbon {
  opacity: 0.2;
  z-index: 1;
}

.value {
  font-size: 20px;
  font-weight: 100;
  z-index: 2;
  cursor: default;
}

.label {
  z-index: 2;
  cursor: default;
  line-height: 1rem;
}

.tiny {
  z-index: 2;
  font-size: 10px !important;
  line-height: 11px;
}

.drop {
  position: absolute;
  top: 0px;
  z-index: 1;
  border-radius: 3px;
}

.m3 {
  margin-top: 2rem;
  margin-right: 4rem;
}
</style>
