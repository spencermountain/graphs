const Deck = require('@deck.gl/core').Deck
const GeoJsonLayer = require('@deck.gl/layers').GeoJsonLayer
const scaleLinear = require('./scale')

let scale = scaleLinear({
  world: [0, 30000],
  minmax: [0, 180]
})

const INITIAL_VIEW_STATE = {
  zoom: 14.0,
  altitude: 1.5,
  bearing: -66.66666666666666,
  height: 1010,
  latitude: 43.66299977225194,
  longitude: -79.36288959277174,
  maxPitch: 60,
  maxZoom: 20,
  minPitch: 0,
  minZoom: 0,
  pitch: 50
}

let layers = [
  {
    id: 'buildings',
    path: './assets/buildings.json',
    elevation: 0.2,
    fill: [237, 240, 238]
  },
  // {
  //   id: 'land',
  //   path: './assets/land.json',
  //   elevation: 0.001,
  //   fill: [255, 255, 255]
  // }
  {
    id: 'greatLakes',
    path: './assets/lake-ontario-partial.json',
    elevation: 0.01,
    fill: [91, 131, 186]
  }
]

const color = function() {
  let r = Math.random() * 50
  return [237 + r, 240 + r, 238 + r]
}

layers = layers.map(o => {
  return new GeoJsonLayer({
    id: o.id,
    data: o.path,
    stroked: false,
    filled: true,
    extruded: true,
    opacity: 0.8,
    getElevation: scale(o.elevation || 0.2),
    getFillColor: () => {
      return o.fill || color()
    },
    pickable: true,
    getStrokeColor: [70, 130, 180]
    // onClick: ({ object, x, y }) => {
    //   console.log(object)
    // }
  })
})

layers.push(
  new GeoJsonLayer({
    id: 'subway',
    data: './assets/subway.json',
    pickable: false,
    stroked: false,
    filled: true,
    extruded: true,
    lineWidthScale: 10,
    lineWidthMinPixels: 2,
    getFillColor: [160, 160, 180, 200],
    getLineColor: [194, 22, 30],
    getRadius: 100,
    getLineWidth: 4
  })
)
layers.push(
  new GeoJsonLayer({
    id: 'ontario-east',
    data: './assets/ontario-line-east.json',
    pickable: false,
    stroked: true,
    filled: true,
    extruded: true,
    lineWidthScale: 10,
    getElevation: scale(0.7),
    lineWidthMinPixels: 2,
    getLineColor: [97, 34, 156],
    getRadius: 100,
    getLineWidth: 4
  })
)
layers.push(
  new GeoJsonLayer({
    id: 'ontario-west',
    data: './assets/ontario-west.json',
    pickable: false,
    stroked: true,
    filled: true,
    extruded: true,
    lineWidthScale: 10,
    lineWidthMinPixels: 2,
    getElevation: scale(0.7),
    getLineColor: [97, 34, 156],
    getRadius: 100,
    getLineWidth: 4
  })
)
layers.push(
  new GeoJsonLayer({
    id: 'stations',
    data: './assets/stations.json',
    stroked: true,
    filled: true,
    extruded: true,
    opacity: 1,
    getElevation: scale(0.7),
    getFillColor: () => {
      return [97, 34, 156]
    },
    pickable: true,
    getStrokeColor: [107, 54, 166]
  })
)
layers.push(
  new GeoJsonLayer({
    id: 'already-stations',
    data: './assets/already-stations.json',
    stroked: true,
    filled: true,
    extruded: true,
    opacity: 1,
    getElevation: scale(0.7),
    getFillColor: () => {
      return [194, 22, 30]
    },
    pickable: true,
    getStrokeColor: [107, 54, 166]
  })
)

new Deck({
  initialViewState: INITIAL_VIEW_STATE,
  controller: true,
  layers: layers
})
