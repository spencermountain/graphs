import line1 from '../data/stops/line-1.js'
import line2 from '../data/stops/line-2.js'
import line3 from '../data/stops/line-3.js'
import line4 from '../data/stops/line-4.js'
import line5 from '../data/stops/line-5.js'



let dots = []
line1.forEach(obj => {
  dots.push({
    "type": "Feature",
    "properties": { "color": "#f5deb3" },
    "geometry": {
      "type": "Point",
      "coordinates": [obj.geo.lon, obj.geo.lat]
    }
  })
})
line2.forEach(obj => {
  dots.push({
    "type": "Feature",
    "properties": { "color": "#5b7848" },
    "geometry": {
      "type": "Point",
      "coordinates": [obj.geo.lon, obj.geo.lat]
    }
  })
})
line3.forEach(obj => {
  dots.push({
    "type": "Feature",
    "properties": { "color": "steelblue" },
    "geometry": {
      "type": "Point",
      "coordinates": [obj.geo.lon, obj.geo.lat]
    }
  })
})
line4.forEach(obj => {
  dots.push({
    "type": "Feature",
    "properties": { "color": "#6D5685" },
    "geometry": {
      "type": "Point",
      "coordinates": [obj.geo.lon, obj.geo.lat]
    }
  })
})
line5.forEach(obj => {
  dots.push({
    "type": "Feature",
    "properties": { "color": "#e09b75" },
    "geometry": {
      "type": "Point",
      "coordinates": [obj.geo.lon, obj.geo.lat]
    }
  })
})

const addStops = function (map) {
  // Add the vector tileset as a source.
  map.addSource('stops', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: dots

    }
  })
  map.addLayer({
    'id': 'stops',
    'type': 'circle',
    'source': 'stops',
    'paint': {
      'circle-radius': 7,
      'circle-opacity': 0.7,
      'circle-color': ['get', 'color']
    }
  })



}
export default addStops