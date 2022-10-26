<script>
  import { onMount } from 'svelte'
  import addWards from './layers/addWards.js'
  import addDots from './layers/addBuildings.js'
  import addMask from './layers/addMask.js'
  // import addTTC from './layers/addTTC.js'
  import addGround from './layers/addGround.js'
  import mapboxgl from 'mapbox-gl'
  mapboxgl.accessToken = 'pk.eyJ1Ijoic3BlbmNlcm1vdW50YWluIiwiYSI6Inp5UVZEY3cifQ.dh-_SvkPgv9YOQZLG5ZHKg'
  onMount(async () => {
    const map = new mapboxgl.Map({
      container: 'map', // container ID
      style: 'mapbox://styles/spencermountain/cl8hsb6pu000b14pvl6ygi76f',
      center: [-79.43, 43.65],
      pitch: 55,
      bearing: 5,
      zoom: 12,
      projection: 'globe',
      maxBounds: [
        -79.68507,
        43.4204, //southwest
        -79.0349,
        44.0492, //northeast
      ],
    })
    map.on('load', () => {
      addWards(map)
      addDots(map)
      // addTTC(map)
      addMask(map)
      addGround(map)
    })
  })
</script>

<div class="container">
  <div id="map" />
</div>

<style>
  .container {
    /* margin: 3rem; */
    /* width: 100vw; */
    /* min-height: 800px; */
    border: 1px solid grey;
  }
  #map {
    min-width: 100vw;
    min-height: 100vh;
  }
</style>
