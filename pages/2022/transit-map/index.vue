<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import { addMask, addGround, addWards, addTTC, addRounds } from './layers.js'

definePageMeta({ title: 'Toronto transit stops by ward', description: 'transit stations by ward, Oct 2022' })

// camera, ported from the mapbox original
const view = {
  center: [-79.43, 43.65],
  pitch: 55,
  bearing: 5,
  zoom: 11,
  maxBounds: [-79.68507, 43.4204, -79.0349, 44.0492], // sw, ne
}

const mapEl = ref(null)
let map = null

onMounted(async () => {
  const maplibregl = (await import('maplibre-gl')).default // client-only lib
  map = new maplibregl.Map({
    container: mapEl.value,
    ...view,
    // the original mapbox base style was fully covered by the layers below — a blank style is faithful
    style: { version: 8, projection: { type: 'globe' }, sources: {}, layers: [] },
    attributionControl: false,
  })
  map.on('load', () => {
    addMask(map)
    addGround(map)
    addWards(map)
    addTTC(map)
    addRounds(map)
  })
})

onBeforeUnmount(() => map && map.remove())
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <!-- header -->
    <div class="w-full max-w-5xl mx-auto mb-4">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Toronto transit stops by ward</h1>
      <div class="text-sm text-gray-400">transit stations by ward, Oct 2022</div>
    </div>

    <!-- map card -->
    <div class="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
      <ClientOnly>
        <div ref="mapEl" class="map"></div>
      </ClientOnly>
    </div>

    <!-- footer -->
    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
.map {
  width: 100%;
  min-height: 750px;
}
</style>
