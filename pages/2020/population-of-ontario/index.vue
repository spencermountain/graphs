<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import colors from '~/assets/colors.js'
import layout from './sankey.js'

definePageMeta({ title: 'Population of Ontario', description: 'city populations, as a sankey' })

// --- config ---
const height = 1000 // px
const nodeWidth = 90 // px
const accent = '#d98b89' // node underline + default number color

// populations in millions — Toronto boroughs → GTA → Ontario → Canada
// https://en.wikipedia.org/wiki/List_of_cities_in_Canada
// https://en.wikipedia.org/wiki/Golden_Horseshoe
const cols = [
  [
    { name: 'Downtown', to: 'Toronto', value: 0.9, color: 'sea' },
    { name: 'North York', to: 'Toronto', value: 0.869, color: 'sea' },
    { name: 'Scarborough', to: 'Toronto', value: 0.6, color: 'sea', show_num: false },
    { name: 'Etobicoke', to: 'Toronto', value: 0.345, color: 'sea', show_num: false },
  ],
  [
    { name: 'Toronto', to: 'Greater Toronto', value: 2.7, color: 'sea' },
    { name: 'Missisauga', to: 'Greater Toronto', value: 0.828, color: 'mud', show_num: false },
    { name: 'Brampton', to: 'Greater Toronto', value: 0.6, color: 'mud', show_num: false },
    { name: 'Oakville', to: 'Greater Toronto', value: 0.2, color: 'mud', show_num: false },
    { name: 'Markham', to: 'Greater Toronto', value: 0.301, color: 'mud', show_num: false },
    { name: 'Vaughn', to: 'Greater Toronto', value: 0.288, color: 'mud', show_num: false },
    { name: 'Richmond Hill', to: 'Greater Toronto', value: 0.185, color: 'mud', show_num: false },
    { name: 'Burlington', to: 'Greater Toronto', value: 0.175, color: 'mud', show_num: false },
  ],
  [
    { name: 'Greater Toronto', to: 'Ontario', value: 6, color: 'sky' },
    { name: 'Hamilton', to: 'Ontario', value: 0.53, color: 'mud' },
    { name: 'Kitchener', to: 'Ontario', value: 0.2, color: 'mud', show_num: false },
    { name: 'London', to: 'Ontario', value: 0.366, color: 'mud', show_num: false },
    { name: 'Oshawa', to: 'Ontario', value: 0.159, color: 'mud', show_num: false },
    { name: 'Sudbury', to: 'Ontario', value: 0.161, color: 'mud', show_num: false },
    { name: 'Barrie', to: 'Ontario', value: 0.14, color: 'mud', show_num: false },
    { name: 'Ottawa', to: 'Ontario', value: 0.9, color: 'red', stroke: '#d7d5d2' },
    { name: 'Windsor', to: 'Ontario', value: 0.21, color: 'mud', show_num: false },
  ],
  [{ name: 'Ontario', to: 'Canada', value: 14, color: 'blue' }],
]

// 0.9 (millions) → '900k' — ported from the original Post.svelte
const fmt = (num) => {
  num = Number(num) * 1000000
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
  const items = cols.flatMap((list, col) => list.map((n) => ({ show_num: true, ...n, col })))
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
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Population of Ontario</h1>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl">
      <div class="mr-24 my-8">
        <div ref="box" class="relative">
          <!-- node boxes, absolutely positioned above the svg links -->
          <div class="absolute" :style="{ width: width + 'px', height: height + 'px' }">
            <div v-for="d in nodes" :key="d.col + d.name" class="node" :class="{ tiny: d.height < 75 }"
              :title="d.name" :style="{
                left: d.x + 'px',
                top: d.y + 'px',
                width: d.width + 'px',
                height: d.height + 'px',
              }">
              <div class="drop" :style="{ width: '100%', height: '100%', backgroundColor: colors[d.color] || d.color }">
              </div>
              <div class="label">{{ d.name }}</div>
              <div v-if="d.show_num" class="value" :class="{ tiny: d.height < 75 }"
                :style="{ color: colors[d.stroke] || d.stroke || accent }">
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
/* ported from somehow-sankey Sankey.svelte (the newer build this page shipped with) */
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

.slink {
  opacity: 0.2;
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
  font-size: 10px !important;
  line-height: 11px;
}

.drop {
  position: absolute;
  top: 0px;
  z-index: 1;
  border-radius: 3px;
}
</style>
