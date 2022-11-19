import wards from '../data/outline-full.js'

const addMask = function (map) {

  map.addSource('mask-source', {
    type: 'geojson',
    data: wards,
  })

  map.addLayer({
    id: 'mask-fill',
    type: 'fill',
    source: 'mask-source', // reference the data source
    layout: {},
    paint: {
      'fill-color': '#fbfbfb', // blue color fill
      'fill-opacity': 1,
    },
  })

}
export default addMask
