<script setup>
import colors from '~/assets/colors.js'
import layout from './sankey.js'

definePageMeta({ title: '2019 Budget of the Toronto Maple Leafs', description: '(in millions)' })

// tunables — same as the 2020 original
const width = 500
const height = 800
const nodeWidth = 125
const stroke = colors.lighter // percent-text color
const accent = '#d98b89' // node underline

// same data as Post.svelte (values in $millions)
const items = [
  { col: 1, name: 'NHL', to: 'Leafs', value: 8, color: colors.greypurple, show_percent: true },
  { col: 1, name: 'Tickets', to: 'Leafs', value: 50, color: colors.sky, show_percent: true },
  { col: 1, name: 'In-Arena', to: 'Leafs', value: 20, color: colors.sea, show_percent: true },
  { col: 1, name: 'LocalTV', to: 'Leafs', value: 5, color: colors.mud, show_percent: true },
  { col: 2, name: 'Leafs', value: 83, color: 'steelblue' },
  { col: 3, name: 'Player Salary', from: 'Leafs', value: 75, color: colors.red, show_percent: true },
  { col: 3, name: 'Coach', from: 'Leafs', value: 6, color: colors.greygreen, show_percent: true },
]

// pure math — safe to run during SSR
const { nodes, paths } = layout(items, { width, height, nodeWidth })
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <a href="/" class="link text-sm text-gray-400 self-start">〱 graphs</a>
    <h1>2019 Budget of the Toronto Maple Leafs</h1>
    <div class="text-gray-400 mb-6">(in millions)</div>

    <div class="bg-white rounded-xl shadow-md p-6">
      <div style="margin-right:3rem; margin-top:2rem;">
        <div class="relative" :style="{ width: width + 'px' }">
          <!-- nodes -->
          <div class="absolute top-0 left-0" :style="{ width: width + 'px', height: height + 'px' }">
            <div v-for="d in nodes" :key="d.name" class="node" :class="{ tiny: d.height < 75 }" :title="d.name"
              :style="{ left: d.x + 'px', top: d.y + 'px', width: d.width + 'px', height: d.height + 'px', opacity: d.opacity }">
              <div class="drop"
                :style="{ width: '100%', height: d.full + '%', backgroundColor: d.color, borderBottom: '4px solid ' + accent }">
              </div>
              <div class="label">{{ d.name }}</div>
              <div v-if="d.show_percent" class="value" :class="{ tiny: d.height < 75 }"
                :style="{ color: stroke, opacity: 0.8 }">{{ d.percent }}</div>
            </div>
          </div>
          <!-- links -->
          <svg :viewBox="`0,0,${width},${height}`" :width="width" :height="height">
            <path v-for="(d, i) in paths" :key="i" class="link" :d="d" stroke="none" fill="lightsteelblue" />
          </svg>
        </div>
      </div>
    </div>

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

.link {
  opacity: 0.2;
}

.link:hover {
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
</style>
