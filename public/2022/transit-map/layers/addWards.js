import wards from '../data/wards.js'




const addWards = function (map) {
  map.addSource('wards', {
    type: 'geojson',
    data: wards,
  })
  map.addLayer({
    id: 'outline',
    type: 'fill-extrusion',
    source: 'wards',
    layout: {},
    paint: {
      // 'line-color': ['get', 'color'],
      // 'fill-extrusion-line-width': 2,
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.9
    },
  })

}
export default addWards