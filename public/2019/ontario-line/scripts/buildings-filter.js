const md5 = require('pure-md5').md5
let result = {
  type: 'FeatureCollection',
  features: []
}

const makeHash = function(chunk) {
  return md5(JSON.stringify(chunk))
}

const topLeft = {
  lon: -79.4321,
  lat: 43.72415
}
const bottomRight = {
  lon: -79.31,
  lat: 43.62746
}

const sundayDriver = require('sunday-driver')
const fs = require('fs')

let options = {
  file: '/Users/spencer/Desktop/Ontario.json',
  splitter: '\n',
  //do your thing, for each segment
  each: (chunk, resume) => {
    try {
      chunk = chunk.replace(/,\s*$/, '')
      // console.log(chunk)
      chunk = JSON.parse(chunk)
      let point = chunk.geometry.coordinates[0][0]
      if (point[0] < bottomRight.lon && point[0] > topLeft.lon) {
        if (point[1] > bottomRight.lat && point[1] < topLeft.lat) {
          chunk.id = makeHash(chunk)
          result.features.push(chunk)
          console.log(result.features.length)
        }
      }
    } catch (e) {
      // console.log(e)
    }
    resume()
  }
}

sundayDriver(options).then(status => {
  console.log('done!')
  fs.writeFileSync('./west-end.json', JSON.stringify(result))
})
