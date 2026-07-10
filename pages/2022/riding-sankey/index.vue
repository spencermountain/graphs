<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import layout from './sankey.js'
import counts from './counts.js'

definePageMeta({
  title: 'Active housing applications by Toronto ward',
  description: 'building permits — toronto.ca, Oct 2022',
})

// --- config ---
const height = 700 // px (original <Sankey height="700">)
const nodeWidth = 120 // px
const defaultAccent = '#d98b89' // node underline when no accent given
const stroke = '#d7d5d2' // percent text color

// ward colors from the original Post.svelte
const wardColors = {
  'Spadina-Fort York': '#D68881',
  'Toronto Centre': '#6699cc',
  'University-Rosedale': '#cc6966',
  'Etobicoke-Lakeshore': '#2D85A8',
  "Toronto-St. Paul's": 'rgb(115, 121, 155)',
  'Parkdale-High Park': '#2D85A8',
  'Toronto-Danforth': '#73799B',
  Willowdale: '#585A73',
  'Eglinton-Lawrence': '#cc6966',
  Davenport: 'rgb(115, 121, 155)',
  'Don Valley North': '#cc8a66',
  'Etobicoke Centre': '#838B91',
  'Beaches-East York': '#735873',
  'York South-Weston': '#D68881',
  'York Centre': '#4D6899',
  'Don Valley West': '#D68881',
  'Scarborough Southwest': '#6699cc',
  'Don Valley East': 'rgb(115, 121, 155)',
  'Scarborough-Agincourt': '#2D85A8',
  'Etobicoke North': '#978BA3',
  'Scarborough-Rouge Park': '#cc6966',
  'Scarborough Centre': '#914045',
  'Scarborough-Guildwood': '#cc6966',
  'Humber River-Black Creek': '#AB5850',
  'Scarborough North': '#6699cc',
}

const sum = counts.reduce((h, a) => h + a.total, 0)

// one source node, then a node per ward (counts are ranked by total)
// after: hide the name • inline: name + percent side-by-side • show_percent: top-7 wards only
const makeItems = () =>
  [
    { name: 'Housing Units', value: sum, color: '#2D85A8', accent: '#6699cc', col: 0 },
    ...counts.map((a, i) => ({
      name: a.name,
      from: 'Housing Units',
      value: a.total,
      color: wardColors[a.name],
      accent: wardColors[a.name],
      after: i > 6,
      inline: i === 5 || i === 6,
      show_percent: i < 7,
      col: 1,
    })),
  ].map((n) => ({ to: '', ...n }))

const box = ref(null)
const width = ref(500) // re-measured on mount (original used bind:clientWidth)
const nodes = ref([])
const paths = ref([])

// layout mutates its input, so hand it a fresh copy each time
const relayout = () => {
  width.value = box.value.clientWidth
  const res = layout(makeItems(), width.value, height, nodeWidth)
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
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Active housing applications by Toronto ward</h1>
      <div class="text-sm text-gray-400">building permits — toronto.ca, Oct 2022</div>
    </div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl">
      <div class="my-8">
        <div ref="box" class="relative">
          <!-- node boxes, absolutely positioned above the svg links -->
          <div class="absolute" :style="{ width: width + 'px', height: height + 'px' }">
            <div v-for="d in nodes" :key="d.name" class="node" :title="d.name"
              :class="{ tiny: d.height < 75, inline: d.inline }" :style="{
                left: d.x + 'px',
                top: d.y + 'px',
                width: d.width + 'px',
                height: d.height + 'px',
                borderBottom: '4px solid ' + (d.accent || defaultAccent),
              }">
              <div class="drop" :style="{ backgroundColor: d.color }"></div>
              <div class="label" :class="{ after: d.after }">{{ d.name }}</div>
              <div v-if="d.show_percent" class="value" :class="{ tiny: d.height < 75 }"
                :style="{ color: stroke, opacity: 0.8 }">
                {{ d.percent }}
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
      <a class="link" href="https://open.toronto.ca/dataset/building-permits-active-permits/">active permits —
        toronto.ca</a>
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* ported from somehow-sankey Sankey.svelte (2022 version) */
.node {
  position: absolute;
  border-radius: 3px;
  color: #dedede;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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

.inline {
  flex-direction: row;
  justify-content: space-evenly;
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
  width: 100%;
  height: 100%;
}

/* nodes ranked 8+ hide their name */
.after {
  display: none;
}
</style>
