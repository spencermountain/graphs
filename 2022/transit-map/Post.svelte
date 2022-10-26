<script>
  import { onMount } from 'svelte'
  import addWards from './layers/addWards.js'
  // import addDots from './layers/addBuildings.js'
  import addMask from './layers/addMask.js'
  import addTTC from './layers/addTTC.js'
  import addStops from './layers/addStops.js'
  import addGround from './layers/addGround.js'
  import addRounds from './layers/addRounds.js'
  import mapboxgl from 'mapbox-gl'
  mapboxgl.accessToken = 'pk.eyJ1Ijoic3BlbmNlcm1vdW50YWluIiwiYSI6Inp5UVZEY3cifQ.dh-_SvkPgv9YOQZLG5ZHKg'
  onMount(async () => {
    const map = new mapboxgl.Map({
      container: 'map', // container ID
      // style: 'mapbox://styles/spencermountain/cl8ysxlkb000m15q9o3lud9yk',
      center: [-79.43, 43.65],
      pitch: 55,
      bearing: 5,
      zoom: 11,
      projection: 'globe',
      maxBounds: [
        -79.68507,
        43.4204, //southwest
        -79.0349,
        44.0492, //northeast
      ],
    })
    map.on('load', () => {
      addMask(map)
      addGround(map)
      addWards(map)
      addTTC(map)
      // addStops(map)
      addRounds(map)
    })
  })
</script>

<div style="position:relative;">
  <div class="container">
    <div id="map" />
  </div>
  <div class="label">transit stations by ward, Oct 2022</div>
</div>

<style>
  .label {
    position: absolute;
  }
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
