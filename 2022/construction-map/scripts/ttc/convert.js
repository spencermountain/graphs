
import ogr2ogr from 'ogr2ogr'

let { data } = await ogr2ogr.default('/Users/spencer/Downloads/ttc-subway-shapefile-wgs84/TTC_SUBWAY_LINES_WGS84.shp')
console.log(JSON.stringify(data, null, 2))
