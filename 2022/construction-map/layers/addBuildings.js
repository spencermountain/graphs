import pipeline from '../data/pipeline.js'

const hScale = function (n) {
  if (n < 10) {
    return 80
  }
  if (n < 100) {
    return 120
  }
  if (n < 200) {
    return 180
  }
  return 300
}


const makeBox = function (point) {
  let [a, b] = point
  let size = 0.0009
  return [[[a, b], [a - size, b], [a, b - size], [a + size, b - size]]]
}

const colors = {
  "Spadina-Fort York": "#cc7066",
  "Toronto Centre": "#2D85A8",
  "University-Rosedale": "#C4ABAB",
  "Etobicoke-Lakeshore": "#735873",
  "Toronto-St. Paul's": "#8BA3A2",
  "Davenport": "#6accb2",
  "Parkdale-High Park": "#2D85A8",
  "Toronto-Danforth": "#e6b3bc",
  "Willowdale": "#6D5685",
  "Eglinton-Lawrence": "#cc8a66",
  "Don Valley North": "#d8b3e6",
  "Etobicoke Centre": "#6699cc",
  "Beaches-East York": "#735873",
  "York South-Weston": "#d8b3e6",
  "York Centre": "#cc6966",
  "Don Valley West": "#cc8a66",
  "Scarborough Southwest": "#9c896c",
  "Don Valley East": "#838B91",
  "Scarborough-Agincourt": "#2D85A8",
  "Etobicoke North": "#978BA3",
  "Scarborough-Rouge Park": "#7f9c6c",
  "Scarborough Centre": "#914045",
  "Scarborough-Guildwood": "#C4ABAB",
  "Humber River-Black Creek": "#AB5850",
  "Scarborough North": "#C4ABAB",
}

const addDots = function (map) {

  // Add a data source containing GeoJSON data.
  map.addSource('buildings', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: pipeline.map(o => {
        return {
          type: 'Feature',
          "properties": {
            "height": hScale(o.units),
            "base_height": 0,
            "color": colors[o.ward] || "lightgrey"
          },
          geometry: {
            type: 'Polygon',
            coordinates: makeBox([o.geo.lng, o.geo.lat]),
          }
        }
      })

    },
  })


  map.addLayer({
    'id': 'dots',
    'type': 'fill-extrusion',
    'source': 'buildings',
    'paint': {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base_height'],
      'fill-extrusion-opacity': 0.9
    }
  })

}
export default addDots