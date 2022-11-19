<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import { onMount } from 'svelte'
  import addWards from './layers/addWards.js'
  import addDots from './layers/addBuildings.js'
  import addMask from './layers/addMask.js'
  import addGround from './layers/addGround.js'
  import mapboxgl from 'mapbox-gl'
  mapboxgl.accessToken =
    'pk.eyJ1Ijoic3BlbmNlcm1vdW50YWluIiwiYSI6Inp5UVZEY3cifQ.dh-_SvkPgv9YOQZLG5ZHKg'

  let title = 'Active building permits in Toronto'
  onMount(async () => {
    const map = new mapboxgl.Map({
      container: 'map', // container ID
      style: 'mapbox://styles/spencermountain/cl8hsb6pu000b14pvl6ygi76f',
      center: [-79.43, 43.65],
      pitch: 55,
      bearing: 5,
      zoom: 11.1,
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

<Head {title} num="03" sub="Oct 2022" />
<div class="container">
  <div id="map" />
</div>
<Foot {title} />

<style>
  .container {
    /* margin: 3rem; */
    /* width: 100vw; */
    /* min-height: 800px; */
    border: 1px solid grey;
    border-radius: 5px;
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
    margin: 5%;
    padding: 0px;
    overflow: hidden;
  }
  #map {
    min-width: 100%;
    min-height: 700px;
  }
</style>
