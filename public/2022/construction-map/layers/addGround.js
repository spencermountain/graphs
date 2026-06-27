import wards from '../data/wards.js'

const addMask = function (map) {

  // map.addSource('mask-source', {
  //   type: 'geojson',
  //   data: wards,
  // })

  // map.addLayer({
  //   id: 'mask-fill',
  //   type: 'fill',
  //   source: 'mask-source', // reference the data source
  //   layout: {},
  //   paint: {
  //     'fill-color': '#fff', // blue color fill
  //     'fill-opacity': 1,
  //   },
  // })

  // Add a data source containing GeoJSON data.
  map.addSource('ground', {
    type: 'geojson',
    data: wards
  })


  map.addLayer({
    'id': 'ground',
    'type': 'fill', //extr
    'source': 'ground',
    'paint': {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.1
      // 'fill-extrusion-color': ['get', 'color'],
      // 'fill-extrusion-height': 450,
      // 'fill-extrusion-base': 50,
      // 'fill-extrusion-opacity': 0.9
    }
  })

}
export default addMask
