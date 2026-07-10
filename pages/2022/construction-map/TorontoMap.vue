<script setup>
// client-only maplibre map — one 3d box per active building permit
import { ref, onMounted, onBeforeUnmount } from 'vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import wards from './wards.js'
import pipeline from './pipeline.js'

// camera, from the original Post.svelte
const view = {
  center: [-79.43, 43.65],
  pitch: 55,
  bearing: 5,
  zoom: 11.1,
  maxBounds: [-79.68507, 43.4204, -79.0349, 44.0492], // sw, ne
}
// old page background — the original mapbox style was masked to this outside the city
const bg = '#fbfbfb'

// dot color by ward, from the original layers/addBuildings.js
const dotColors = {
  'Spadina-Fort York': '#cc7066',
  'Toronto Centre': '#2D85A8',
  'University-Rosedale': '#C4ABAB',
  'Etobicoke-Lakeshore': '#735873',
  "Toronto-St. Paul's": '#8BA3A2',
  'Davenport': '#6accb2',
  'Parkdale-High Park': '#2D85A8',
  'Toronto-Danforth': '#e6b3bc',
  'Willowdale': '#6D5685',
  'Eglinton-Lawrence': '#cc8a66',
  'Don Valley North': '#d8b3e6',
  'Etobicoke Centre': '#6699cc',
  'Beaches-East York': '#735873',
  'York South-Weston': '#d8b3e6',
  'York Centre': '#cc6966',
  'Don Valley West': '#cc8a66',
  'Scarborough Southwest': '#9c896c',
  'Don Valley East': '#838B91',
  'Scarborough-Agincourt': '#2D85A8',
  'Etobicoke North': '#978BA3',
  'Scarborough-Rouge Park': '#7f9c6c',
  'Scarborough Centre': '#914045',
  'Scarborough-Guildwood': '#C4ABAB',
  'Humber River-Black Creek': '#AB5850',
  'Scarborough North': '#C4ABAB',
}

// bar height from unit count (original hScale)
const hScale = (n) => (n < 10 ? 80 : n < 100 ? 120 : n < 200 ? 180 : 300)

// tiny footprint polygon around a point (original makeBox)
const size = 0.0009
const makeBox = ([a, b]) => [[[a, b], [a - size, b], [a, b - size], [a + size, b - size]]]

const el = ref(null)
let map = null

onMounted(async () => {
  const maplibregl = (await import('maplibre-gl')).default
  map = new maplibregl.Map({
    container: el.value,
    // plain background stands in for the dead custom mapbox style
    style: {
      version: 8,
      sources: {},
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': bg } }],
    },
    attributionControl: false, // original hid attribution via css
    ...view,
  })

  map.on('load', () => {
    map.addSource('wards', { type: 'geojson', data: wards })
    // light ward tint (original addGround.js)
    map.addLayer({
      id: 'ground',
      type: 'fill',
      source: 'wards',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.1 },
    })
    // ward outlines (original addWards.js)
    map.addLayer({
      id: 'outline',
      type: 'line',
      source: 'wards',
      paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
    })
    // extruded box per permit (original addBuildings.js)
    map.addSource('buildings', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: pipeline.map((o) => ({
          type: 'Feature',
          properties: { height: hScale(o.units), base_height: 0, color: dotColors[o.ward] || 'lightgrey' },
          geometry: { type: 'Polygon', coordinates: makeBox([o.geo.lng, o.geo.lat]) },
        })),
      },
    })
    map.addLayer({
      id: 'dots',
      type: 'fill-extrusion',
      source: 'buildings',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.9,
      },
    })
  })
})

onBeforeUnmount(() => map && map.remove())
</script>

<template>
  <div ref="el" class="w-full h-[700px]" :style="{ backgroundColor: bg }"></div>
</template>
