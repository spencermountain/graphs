// map layers, ported from the 2022 mapbox-gl original (same order + paint values)
import { circle } from '@turf/turf'
import wards from './data/wards.js'
import outlineFull from './data/outline-full.js'
import ttc from './data/ttc.js'
import line1 from './data/stops/line-1.js'
import line2 from './data/stops/line-2.js'
import line3 from './data/stops/line-3.js'
import line4 from './data/stops/line-4.js'
import line5 from './data/stops/line-5.js'
import xEmoji from './data/x-emoji.png'

// world polygon with the city cut out
export const addMask = (map) => {
  map.addSource('mask-source', { type: 'geojson', data: outlineFull })
  map.addLayer({
    id: 'mask-fill',
    type: 'fill',
    source: 'mask-source',
    paint: { 'fill-color': '#fff', 'fill-opacity': 1 },
  })
}

// plain page-coloured backdrop (covers everything below it, as in the original)
export const addGround = (map) => {
  map.addLayer({
    id: 'background',
    type: 'background',
    paint: { 'background-color': '#fbfbfb' },
  })
}

// extruded ward polygons — color + height baked into data/wards.js
export const addWards = (map) => {
  map.addSource('wards', { type: 'geojson', data: wards })
  map.addLayer({
    id: 'outline',
    type: 'fill-extrusion',
    source: 'wards',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.9,
    },
  })
}

// subway/lrt route lines
export const addTTC = (map) => {
  map.addSource('ttc', { type: 'geojson', data: ttc })
  map.addLayer({
    id: 'lines',
    type: 'line',
    source: 'ttc',
    paint: { 'line-width': 6, 'line-color': ['get', 'color'] },
  })
}

// one 220m turf circle per station, coloured by line
const makeCircle = (center, prop) =>
  circle(center, 0.22, { steps: 30, units: 'kilometers', properties: prop })

const lineColors = [
  [line1, '#f5deb3'],
  [line2, '#5b7848'],
  [line3, 'steelblue'],
  [line4, '#6D5685'],
  [line5, '#e09b75'],
]
const dots = lineColors.flatMap(([stops, color]) =>
  stops.map((obj) => makeCircle([obj.geo.lon, obj.geo.lat], { color }))
)

// closing scarborough-RT stations, marked with an ✕ icon
const xPoints = [
  [-79.27028, 43.75028],
  [-79.27639, 43.76694],
  [-79.27194, 43.77042],
  [-79.25167, 43.77492],
  [-79.25778, 43.77444],
].map((coordinates) => ({ type: 'Feature', geometry: { type: 'Point', coordinates } }))

export const addRounds = async (map) => {
  map.addSource('stops', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: dots },
  })
  map.addLayer({
    id: 'stops',
    type: 'fill',
    source: 'stops',
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.9 },
  })
  // maplibre v5 loadImage is promise-based
  const image = await map.loadImage(xEmoji)
  map.addImage('x-icon', image.data)
  map.addSource('point', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: xPoints },
  })
  map.addLayer({
    id: 'points',
    type: 'symbol',
    source: 'point',
    layout: { 'icon-image': 'x-icon', 'icon-size': 0.023, 'icon-allow-overlap': true },
  })
}
