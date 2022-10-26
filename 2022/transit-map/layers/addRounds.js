import line1 from '../data/stops/line-1.js'
import line2 from '../data/stops/line-2.js'
import line3 from '../data/stops/line-3.js'
import line4 from '../data/stops/line-4.js'
import line5 from '../data/stops/line-5.js'
import * as turf from "@turf/turf"

// let center = [-79.43, 43.65]

const makeCircle = (center, prop) => {
  let radius = 0.22
  let options = { steps: 30, units: 'kilometers', properties: prop }
  let circle = turf.circle(center, radius, options)
  return circle
}

let dots = []
line1.forEach(obj => {
  let res = makeCircle([obj.geo.lon, obj.geo.lat], { "color": "#f5deb3" })
  dots.push(res)
})
line2.forEach(obj => {
  dots.push(makeCircle([obj.geo.lon, obj.geo.lat], { "color": "#5b7848" }))
})
line3.forEach(obj => {
  dots.push(makeCircle([obj.geo.lon, obj.geo.lat], { "color": "steelblue" }))
})
line4.forEach(obj => {
  dots.push(makeCircle([obj.geo.lon, obj.geo.lat], { "color": "#6D5685" }))
})
line5.forEach(obj => {
  dots.push(makeCircle([obj.geo.lon, obj.geo.lat], { "color": "#e09b75" }))
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
    'type': 'fill',
    'source': 'stops',
    'paint': {
      "fill-color": ['get', 'color'],
      "fill-opacity": 0.9
    }
  })



  // map.addSource('label', {

  //   type: 'geojson',
  //   data: {
  //     'type': 'FeatureCollection',
  //     'features': [
  //       {
  //         'type': 'Feature',
  //         'properties': {
  //           'icon': 'theatre'
  //         },
  //         'geometry': {
  //           'type': 'Point',
  //           'coordinates': [-79.43, 43.65]
  //         }
  //       },
  //     ]
  //   }
  // })

  // map.addLayer({
  //   'id': 'text',
  //   'type': 'symbol',
  //   'source': 'label',

  //   'layout': {
  //     'icon-image': `theatre-15`,
  //     'icon-allow-overlap': true,
  //     // 'text-field': 'hello',
  //     'text-font': [
  //       'Open Sans Bold',
  //       'Arial Unicode MS Bold'
  //     ],
  //     'text-size': 61,
  //     'text-transform': 'uppercase',
  //     'text-letter-spacing': 0.05,
  //     'text-offset': [0, 1.5],
  //   },
  //   'paint': {
  //     'text-color': 'red',
  //     'text-halo-color': '#fff',
  //     'text-halo-width': 2
  //   }
  // })
  map.loadImage(
    './data/x-emoji.png',
    (error, image) => {
      if (error) throw error

      // Add the image to the map style.
      map.addImage('cat', image)

      // Add a data source containing one point feature.
      map.addSource('point', {
        'type': 'geojson',
        'data': {
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'geometry': {
                'type': 'Point',
                'coordinates': [-79.27028, 43.75028]
              }
            },
            {
              'type': 'Feature',
              'geometry': {
                'type': 'Point',
                'coordinates': [-79.27639, 43.76694]
              }
            },
            {
              'type': 'Feature',
              'geometry': {
                'type': 'Point',
                'coordinates': [-79.27194, 43.77042]
              }
            },

            {
              'type': 'Feature',
              'geometry': {
                'type': 'Point',
                'coordinates': [-79.25167, 43.77492]
              }
            },
            {
              'type': 'Feature',
              'geometry': {
                'type': 'Point',
                'coordinates': [-79.25778, 43.77444]
              }
            }
          ]
        }
      })

      // Add a layer to use the image to represent the data.
      map.addLayer({
        'id': 'points',
        'type': 'symbol',
        'source': 'point', // reference the data source
        'layout': {
          'icon-image': 'cat', // reference the image
          'icon-size': 0.023,
          'icon-allow-overlap': true
        }
      })
    }
  )

}
export default addStops