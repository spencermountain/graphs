<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import { onMount } from 'svelte'
  import addWards from './layers/addWards.js'
  import addMask from './layers/addMask.js'
  import addTTC from './layers/addTTC.js'
  import addGround from './layers/addGround.js'
  import addRounds from './layers/addRounds.js'
  import mapboxgl from 'mapbox-gl'
  let title = 'Toronto transit stops by ward'
  mapboxgl.accessToken =
    'pk.eyJ1Ijoic3BlbmNlcm1vdW50YWluIiwiYSI6Inp5UVZEY3cifQ.dh-_SvkPgv9YOQZLG5ZHKg'
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
      addRounds(map)
    })
  })
</script>

<Head {title} num="04" />
<div style="position:relative;">
  <div class="container">
    <div id="map" />
  </div>
  <div class="label">transit stations by ward, Oct 2022</div>
</div>
<Foot {title} />

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
