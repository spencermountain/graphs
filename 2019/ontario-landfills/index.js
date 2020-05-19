const Deck = require('@deck.gl/core').Deck
const GeoJsonLayer = require('@deck.gl/layers').GeoJsonLayer
const scaleLinear = require('./scale')
require('./graph')

let scale = scaleLinear({
  world: [0, 30000],
  minmax: [0, 180]
})

function setTooltip(object, x, y) {
  const el = document.getElementById('tooltip')
  y = y - 50
  if (object) {
    el.innerHTML = object.properties.id + ' Landfill'
    el.style.display = 'block'
    el.style.left = x + 'px'
    el.style.top = y + 'px'
  } else {
    el.style.display = 'none'
  }
}

const INITIAL_VIEW_STATE = {
  zoom: 7,
  altitude: 1.5,
  latitude: 43.66,
  longitude: -79.36,
  maxPitch: 60,
  maxZoom: 9,
  minPitch: 0,
  minZoom: 6.6,
  pitch: 50
}
let layers = []
layers.push(
  new GeoJsonLayer({
    id: 'lake-ontario',
    data: './assets/ontario-lakes.geojson',
    stroked: false,
    filled: true,
    extruded: true,
    opacity: 1,
    getElevation: scale(0.7),
    getFillColor: () => {
      return [106, 163, 230]
    }
  })
)
layers.push(
  new GeoJsonLayer({
    id: 'cities',
    data: './assets/cities.geojson',
    stroked: false,
    filled: true,
    extruded: true,
    opacity: 0.1,
    getElevation: scale(0),
    getFillColor: () => {
      return [242, 242, 235]
    }
  })
)
layers.push(
  new GeoJsonLayer({
    id: 'landfills',
    data: './assets/landfills-all.geojson',
    stroked: false,
    filled: true,
    extruded: true,
    pickable: true,
    opacity: 1,
    getElevation: scale(27),
    getFillColor: () => {
      return [171, 132, 73]
    },
    onHover: info => setTooltip(info.object, info.x, info.y)
  })
)
layers.push(
  new GeoJsonLayer({
    id: 'highways',
    data: './assets/highways.geojson',
    pickable: false,
    stroked: true,
    filled: false,
    extruded: true,
    opacity: 1,
    getElevation: scale(0.2),
    lineWidthScale: 10,
    lineWidthMinPixels: 2,
    getLineColor: [109, 111, 115],
    getRadius: 100,
    getLineWidth: 100
  })
)

new Deck({
  initialViewState: INITIAL_VIEW_STATE,
  controller: {
    scrollZoom: false
  },
  layers: layers
})
