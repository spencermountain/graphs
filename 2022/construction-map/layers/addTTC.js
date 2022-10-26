import ttc from '../data/ttc.js'

const addTTC = function (map) {
  map.addSource('ttc', {
    type: 'geojson',
    data: ttc,
  })
  // map.addLayer({
  //   id: 'outline',
  //   type: 'line',
  //   source: 'ttc',
  //   layout: {},
  //   paint: {
  //     'line-color': 'steelblue',
  //     'line-width': 1.5,
  //   },
  // })

  map.addLayer({
    'id': 'lines',
    'type': 'line',
    'source': 'ttc',
    'paint': {
      'line-width': 5,
      // Use a get expression (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-get)
      // to set the line-color to a feature property value.
      'line-color': ['get', 'color']
    }
  })
}
export default addTTC