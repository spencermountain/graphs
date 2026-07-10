<script setup>
import colors from '~/assets/colors.js'
import capacity from './capacity.js'
import Map3d from './Map3d.vue'

definePageMeta({ title: 'Landfills in Ontario', description: 'the biggest dumps in the province, by approved capacity' })

// -- somehow v0.3.3 chart geometry: 100x54 'widescreen' (1.85) viewBox --
const W = 100
const H = 54
const rowGap = 10 // world-units between rows

// smallest → largest; largest ends up drawn at the top
const sorted = [...capacity].sort((a, b) => a[1] - b[1])
const maxCap = sorted[sorted.length - 1][1]
const maxY = (sorted.length - 1) * rowGap
// same truncating linear scales as somehow
const bars = sorted.map((a, i) => ({
  label: a[0],
  x: Math.trunc((W * a[1]) / maxCap),
  y: Math.trunc((H * (maxY - i * rowGap)) / maxY),
}))
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="self-start mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-2xl font-semibold text-gray-700">Landfills in Ontario</h1>
      <div class="text-gray-400 text-sm">the province's biggest dumps, by total approved capacity</div>
    </div>

    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-5xl">
      <!-- 'By capacity:' bar chart (somehow svg port) -->
      <div class="w-full pt-8 pb-2" style="padding-right: 13%">
        <svg viewBox="0,0,100,54" preserveAspectRatio="xMidYMid meet" class="w-full overflow-visible">
          <text x="50%" y="-5%" :fill="colors.grey" text-anchor="middle" class="legible">By capacity:</text>
          <g v-for="b in bars" :key="b.label">
            <line x1="0" :y1="b.y" :x2="b.x" :y2="b.y" :stroke="colors.blue" stroke-width="4" stroke-linecap="round"
              vector-effect="non-scaling-stroke" />
            <text :x="b.x + 2" :y="b.y + 0.05" fill="grey" style="font-size: 1.5px">{{ b.label }}</text>
          </g>
        </svg>
      </div>

      <!-- the original purple hr -->
      <div class="my-8" :style="{ height: '2px', width: '70%', backgroundColor: colors.purple }"></div>

      <!-- 3d landfill map -->
      <ClientOnly>
        <Map3d />
      </ClientOnly>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
/* somehow's responsive '.somehow-legible' title text */
.legible {
  font-size: 2px;
}

@media (max-width: 600px) {
  .legible {
    font-size: 4px;
  }
}
</style>
