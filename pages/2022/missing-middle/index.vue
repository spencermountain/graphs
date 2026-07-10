<script setup>
import { ref, onMounted } from 'vue'
import colors from '~/assets/colors.js'
import counts from './counts.js'
import layout from './sankey.js'

definePageMeta({ title: "Toronto's missing middle", description: 'Building applications, by number of units' })

// tunables
const height = 700
const nodeWidth = 120

const sum = counts.reduce((n, o) => n + o.total, 0)

// sankey nodes — col 1 flows into col 2 (as in the original Post.svelte)
const items = [
  { name: 'Proposed Units', value: sum, col: 1, color: colors.sea },
  { name: counts[0].name, from: 'Proposed Units', value: counts[0].total, col: 2, color: 'steelblue' },
  { name: '', from: 'Proposed Units', value: counts[1].total, col: 2, color: '#c4abab' },
  { name: counts[2].name, from: 'Proposed Units', value: counts[2].total, col: 2, color: 'steelblue' },
]

// round to nearest thousand — 177186 → '177k'
const fmt = (num) => {
  if (num > 1000) {
    num = Math.round(num / 1000) * 1000
    return String(num / 1000) + 'k'
  }
  return num
}

// layout needs measured width — compute on mount (SSR-safe)
const wrap = ref(null)
const width = ref(500)
const nodes = ref([])
const paths = ref([])
onMounted(() => {
  width.value = wrap.value.clientWidth
  const res = layout(items, width.value, height, nodeWidth)
  nodes.value = res.nodes
  paths.value = res.paths
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
    </div>
    <h1 class="text-xl font-semibold text-gray-700 mt-2">Toronto's missing middle</h1>
    <div class="text-gray-400 mb-4">Building applications, by number of units</div>

    <!-- the graphic -->
    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-[800px]">
      <div class="rel">
        <!-- callout for the sliver of middle-sized buildings -->
        <div class="mid-label">
          ← Middle-sized
          <div style="font-size: 12px">2-12 units</div>
        </div>

        <div ref="wrap" style="position: relative">
          <div :style="{ position: 'absolute', width: width + 'px', height: height + 'px' }">
            <div
              v-for="(d, i) in nodes"
              :key="i"
              class="node"
              :class="{ tiny: d.height < 75 }"
              :title="d.name"
              :style="{ left: d.x + 'px', top: d.y + 'px', width: d.width + 'px', height: d.height + 'px', opacity: d.opacity }"
            >
              <div class="drop" :style="{ width: '100%', height: d.full + '%', backgroundColor: d.color, borderBottom: '4px solid ' + d.accent }"></div>
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
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
      <span>
        filtered
        <a class="link" href="https://open.toronto.ca/dataset/building-permits-active-permits/">Active building permits</a>
        - toronto.ca, Sep 2022
      </span>
    </div>
  </div>
</template>

<style scoped>
/* ported from Post.svelte + the compiled somehow-sankey css */
.rel {
  position: relative;
  margin-top: 2rem;
  min-width: 650px;
}
.mid-label {
  position: absolute;
  min-width: 200px;
  top: 88%;
  left: 460px;
  color: #c4abab;
  z-index: 3;
}
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
</style>
