<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import buildings from './buildings.json'
import lake from './lake-ontario-partial.json'
import subway from './subway.json'
import ontarioEast from './ontario-line-east.json'
import ontarioWest from './ontario-west.json'
import stations from './stations.json'
import alreadyStations from './already-stations.json'

definePageMeta({ title: 'Ontario Line Stations', description: 'the 2019 proposal, in 3d over downtown Toronto' })

// original deck.gl scale: parseInt(30000 * n / 180) metres
const scale = (n) => parseInt((30000 * n) / 180, 10)
const heights = { building: scale(0.2), lake: scale(0.01), station: scale(0.7) } // 33m, 1m, 116m

// original colors
const ttcRed = 'rgb(194, 22, 30)'
const olPurple = 'rgb(97, 34, 156)'
const buildingFill = 'rgb(237, 240, 238)'
const lakeFill = 'rgb(91, 131, 186)'

// original INITIAL_VIEW_STATE
const view = {
  center: [-79.36288959277174, 43.66299977225194],
  zoom: 14,
  pitch: 50,
  bearing: -66.66666666666666,
  maxPitch: 60,
  maxZoom: 20,
}

// deck.gl drew lines 40m wide (lineWidthScale 10 × width 4), min 2px — approximate with zoom stops
const lineWidth = ['interpolate', ['exponential', 2], ['zoom'], 10, 2, 14, 11.6, 20, 740]

const el = ref(null)
let map = null

// helpers for layer defs
const extrusion = (id, data, color, height, opacity) => ({
  source: { type: 'geojson', data },
  layer: { id, type: 'fill-extrusion', source: id, paint: { 'fill-extrusion-color': color, 'fill-extrusion-height': height, 'fill-extrusion-opacity': opacity } },
})
const line = (id, data, color) => ({
  source: { type: 'geojson', data },
  layer: { id, type: 'line', source: id, paint: { 'line-color': color, 'line-width': lineWidth }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
})

onMounted(async () => {
  const maplibregl = (await import('maplibre-gl')).default
  map = new maplibregl.Map({
    container: el.value,
    style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#fbfbfb' } }] },
    ...view,
    attributionControl: false,
  })
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

  const defs = [
    extrusion('lake', lake, lakeFill, heights.lake, 0.8),
    extrusion('buildings', buildings, buildingFill, heights.building, 0.8),
    line('subway', subway, ttcRed),
    line('ontario-east', ontarioEast, olPurple),
    line('ontario-west', ontarioWest, olPurple),
    extrusion('stations', stations, olPurple, heights.station, 1),
    extrusion('already-stations', alreadyStations, ttcRed, heights.station, 1),
  ]
  map.on('load', () => {
    defs.forEach((d) => {
      map.addSource(d.layer.id, d.source)
      map.addLayer(d.layer)
    })
  })
})
onUnmounted(() => map && map.remove())
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 col">
    <div class="self-start w-full max-w-6xl mx-auto">
      <a href="/" class="link text-sm text-gray-400">〱 graphs</a>
      <h1 class="text-xl font-semibold text-gray-700 mt-2">Ontario Line Stations</h1>
      <div class="text-gray-400 text-sm mb-4">the 2019 proposal, in 3d over downtown Toronto — drag to pan, right-click to rotate</div>
    </div>

    <div class="bg-white rounded-xl shadow-md p-6 w-full max-w-6xl mx-auto">
      <ClientOnly>
        <div ref="el" class="map rounded-lg overflow-hidden"></div>
        <template #fallback>
          <div class="map row-center text-gray-300">loading map…</div>
        </template>
      </ClientOnly>

      <!-- legend (colors match the original layers) -->
      <div class="row-left gap-4 mt-4 text-xs text-gray-500">
        <div class="row-left gap-1"><span class="swatch" :style="{ background: olPurple }"></span>Ontario line</div>
        <div class="row-left gap-1"><span class="swatch" :style="{ background: ttcRed }"></span>existing subway</div>
      </div>
    </div>

    <div class="mt-8 text-sm text-gray-400 row-center gap-4">
      <a class="link" href="https://twitter.com/spencermountain">@spencermountain</a>
    </div>
  </div>
</template>

<style scoped>
.map {
  width: 100%;
  height: 75vh;
  background: #fbfbfb;
}

.swatch {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 3px;
}
</style>
