const makeBox = function (point) {
  let [a, b] = point
  let size = 0.0005
  return [[[a, b], [a - size, b], [a, b - size], [a + size, b - size]]]
}

const addDots = function (map) {

  // Add a data source containing GeoJSON data.
  map.addSource('dot', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        // {
        //   type: 'Feature',
        //   geometry: {
        //     type: 'Point',
        //     coordinates: [-79.43, 43.65],
        //   },
        // },
        {
          type: 'Feature',
          "properties": {
            "height": 140,
            "base_height": 0,
            "color": "steelblue"
          },
          geometry: {
            type: 'Polygon',
            coordinates: makeBox([-79.4, 43.65]),
          },
        },
      ],
    },
  })

  // map.addLayer({
  //   id: 'dots',
  //   type: 'circle',
  //   source: 'dot',
  //   paint: {
  //     'circle-color': '#cc6966',
  //     'circle-radius': 5,
  //   },
  // })

  map.addLayer({
    'id': 'dots',
    'type': 'fill-extrusion',
    'source': 'dot',
    'paint': {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base_height'],
      'fill-extrusion-opacity': 0.8
    }
  })

}
export default addDots