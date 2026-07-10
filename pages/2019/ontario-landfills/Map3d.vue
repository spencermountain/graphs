<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import lakes from './lakes.json'
import cities from './cities.json'
import landfills from './landfills.json'
import highways from './highways.json'

// -- deck.gl-era elevation scale: world [0,30000]m over minmax [0,180] --
const scale = (n) => Math.trunc((30000 * n) / 180)

// original camera (deck.gl initialViewState)
const view = { center: [-79.36, 43.66], zoom: 7, pitch: 50, maxPitch: 60, minZoom: 6.6, maxZoom: 9 }

// original fill colors, pre-darkened ~0.69x to bake in deck.gl's default lighting on extruded tops
const color = {
  bg: '#fbfbfb',
  lake: 'rgb(73,112,159)', // was rgb(106,163,230)
  city: 'rgb(167,167,162)', // was rgb(242,242,235)
  landfill: 'rgb(118,91,50)', // was rgb(171,132,73)
  highway: 'rgb(109,111,115)', // paths were unlit
}

const el = ref(null)
const tip = ref(null)
let map = null

onMounted(async () => {
  const maplibregl = (await import('maplibre-gl')).default
  map = new maplibregl.Map({
    container: el.value,
    attributionControl: false,
    scrollZoom: false, // original: controller { scrollZoom: false }
    ...view,
    style: {
      version: 8,
      sources: {
        lakes: { type: 'geojson', data: lakes },
        cities: { type: 'geojson', data: cities },
        landfills: { type: 'geojson', data: landfills },
        highways: { type: 'geojson', data: highways },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': color.bg } },
        // cities: extruded to 0m in deck = flat fill; deck's gamma-corrected 0.1 opacity ≈ 0.35
        { id: 'cities', type: 'fill', source: 'cities', paint: { 'fill-color': color.city, 'fill-opacity': 0.35 } },
        // deck drew 1000m-wide lines with a 2px floor
        {
          id: 'highways', type: 'line', source: 'highways',
          paint: { 'line-color': color.highway, 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 7, 2.3, 9, 9] },
        },
        {
          id: 'lakes', type: 'fill-extrusion', source: 'lakes',
          paint: { 'fill-extrusion-color': color.lake, 'fill-extrusion-height': scale(0.7) },
        },
        {
          id: 'landfills', type: 'fill-extrusion', source: 'landfills',
          paint: { 'fill-extrusion-color': color.landfill, 'fill-extrusion-height': scale(27) },
        },
      ],
    },
  })
  // hover tooltip, like the original setTooltip()
  map.on('mousemove', 'landfills', (e) => {
    tip.value.textContent = e.features[0].properties.id + ' Landfill'
    tip.value.style.display = 'block'
    tip.value.style.left = e.point.x + 'px'
    tip.value.style.top = e.point.y - 50 + 'px'
  })
  map.on('mouseleave', 'landfills', () => {
    tip.value.style.display = 'none'
  })
})
onBeforeUnmount(() => map && map.remove())
</script>

<template>
  <div class="relative w-full rounded-lg overflow-hidden" style="height: 80vh; min-height: 420px">
    <div ref="el" class="w-full h-full"></div>
    <div ref="tip" class="absolute z-10 pointer-events-none text-gray-800" style="display: none"></div>
  </div>
</template>
