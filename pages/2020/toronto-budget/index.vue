<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import colors from '~/assets/colors.js'
import layout from './sankey.js'

definePageMeta({ title: 'Toronto City Budget', description: 'in 2020' })

// --- config (same as the 2020 original) ---
const height = 900 // px
const nodeWidth = 120 // px
const accent = '#d98b89' // node underline + default value color
const grey = '#d7d5d2' // alternate value color

// $millions — three columns: revenue → Toronto → spending. same data as Post.svelte
const items = [
  // revenue
  { col: 1, name: 'Property Taxes', to: 'Toronto', value: 4400, color: 'sea' },
  { col: 1, name: 'Province/Fed', to: 'Toronto', value: 2500, color: 'red', stroke: grey },
  { col: 1, name: 'TTC Fares', to: 'Toronto', value: 1300, color: 'sky', stroke: grey },
  { col: 1, name: 'Fees', to: 'Toronto', value: 900, color: 'sky', stroke: grey },
  { col: 1, name: 'Land-transfer', to: 'Toronto', value: 800, color: 'sky', stroke: grey },
  { col: 1, name: 'Misc', to: 'Toronto', value: 600, color: 'sea' },
  { col: 1, name: 'Investment', to: 'Toronto', value: 300, color: 'sea', show_num: false },
  { col: 1, name: 'Reserves', to: 'Toronto', value: 500, color: 'sea', show_num: false },
  { col: 1, name: 'Transfers', to: 'Toronto', value: 300, color: 'sea', show_num: false },
  // the city — 87.2% funded, dot-pattern shows the covid shortfall
  { col: 2, name: 'Toronto', value: 11600, color: 'blue', full: 87.2, append: '* 1.5bn covid short-fall' },
  // spending
  { col: 3, name: 'Police', from: 'Toronto', value: 1200, color: '#CDADD9', stroke: grey },
  { col: 3, name: 'Fire', from: 'Toronto', value: 490, color: '#CDADD9', stroke: grey },
  { col: 3, name: 'Ems', from: 'Toronto', value: 220, color: '#CDADD9', show_num: false },
  { col: 3, name: 'Housing', from: 'Toronto', value: 750, color: '#8797B7', stroke: grey },
  { col: 3, name: 'Child services', from: 'Toronto', value: 630, color: '#8797B7', stroke: grey },
  { col: 3, name: 'Senior care', from: 'Toronto', value: 260, color: '#8797B7', show_num: false },
  { col: 3, name: 'TTC', from: 'Toronto', value: 1900, color: 'red', stroke: grey },
  { col: 3, name: 'Wheel-trans', from: 'Toronto', value: 160, color: 'red', show_num: false },
  { col: 3, name: 'Unemployment', from: 'Toronto', value: 1100, color: '#8FAEA6' },
  { col: 3, name: 'Library', from: 'Toronto', value: 210, color: '#8FAEA6', show_num: false },
  { col: 3, name: 'Parks', from: 'Toronto', value: 450, color: '#8FAEA6', show_num: false },
  { col: 3, name: 'Public health', from: 'Toronto', value: 270, color: '#8FAEA6', show_num: false },
  { col: 3, name: 'Water', from: 'Toronto', value: 1200, color: 'sky' },
  { col: 3, name: 'Roads', from: 'Toronto', value: 420, color: 'sea', show_num: false },
  { col: 3, name: 'Garbage', from: 'Toronto', value: 400, color: 'sea', show_num: false },
  { col: 3, name: 'Governace', from: 'Toronto', value: 400, color: 'sea', show_num: false },
  { col: 3, name: 'Parking', from: 'Toronto', value: 160, color: 'sea', show_num: false },
  { col: 3, name: 'Debt', from: 'Toronto', value: 500, color: 'sea', show_num: false },
  { col: 3, name: 'Financing', from: 'Toronto', value: 370, color: 'sea', show_num: false },
  { col: 3, name: 'Misc', from: 'Toronto', value: 700, color: 'sea' },
].map((n) => ({ ...n, color: colors[n.color] || n.color })) // named → hex, like spencer-color did

// 4400 → '4.4b' (values are in $millions) — copied from the original Post.svelte
const fmt = (num) => {
  num = Number(num) * 1000000
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

const relayout = () => {
  width.value = box.value.clientWidth
  const res = layout(items, { width: width.value, height, nodeWidth })
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
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Toronto City Budget</h1>
      <div class="text-sm text-gray-400">in 2020</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl">
      <div class="mr-12 mt-8">
        <div ref="box" class="relative">
          <!-- node boxes, absolutely positioned above the svg links -->
          <div class="absolute top-0 left-0" :style="{ width: width + 'px', height: height + 'px' }">
            <div v-for="d in nodes" :key="d.col + d.name" class="node" :class="{ tiny: d.height < 75 }" :title="d.name"
              :style="{ left: d.x + 'px', top: d.y + 'px', width: d.width + 'px', height: d.height + 'px', opacity: d.opacity }">
              <!-- solid fill covers `full`% of the node -->
              <div class="drop"
                :style="{ width: '100%', height: d.full + '%', backgroundColor: d.color, borderBottom: '4px solid ' + accent }">
              </div>
              <!-- white-dot pattern peeks-out below a part-filled node -->
              <div v-if="d.full !== 100" class="dots" :style="{ backgroundColor: d.color }">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern :id="'dots-' + d.name" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
                      <circle fill="white" cx="4" cy="4" r="2" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width="100%" height="100%" :fill="`url(#dots-${d.name})`" />
                </svg>
              </div>
              <div class="label">{{ d.name }}</div>
              <div v-if="d.show_num !== false" class="value" :class="{ tiny: d.height < 75 }"
                :style="{ color: d.stroke || accent }">{{ fmt(d.value) }}</div>
              <div v-if="d.append" class="append" :style="{ color: d.color }">{{ d.append }}</div>
            </div>
          </div>
          <!-- link polygons -->
          <svg :viewBox="`0,0,${width},${height}`" :width="width" :height="height">
            <path v-for="(d, i) in paths" :key="i" class="slink" :d="d" stroke="none" fill="lightsteelblue" />
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

.slink {
  opacity: 0.2;
}

.slink:hover {
  stroke-opacity: 1;
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

.dots {
  position: absolute;
  top: 0px;
  height: 100%;
  width: 100%;
  z-index: 0;
}

.append {
  position: absolute;
  bottom: -30px;
  font-size: 12px;
}
</style>
