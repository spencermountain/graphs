import wards from '../data/wards.js'


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


const addWards = function (map) {
  map.addSource('wards', {
    type: 'geojson',
    data: wards,
  })
  map.addLayer({
    id: 'outline',
    type: 'line',
    source: 'wards',
    layout: {},
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 2,
    },
  })

}
export default addWards