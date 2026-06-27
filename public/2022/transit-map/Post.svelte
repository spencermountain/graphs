<script>
  import { Page } from '../../components/index.mjs'
  import { onMount } from 'svelte'
  import addWards from './layers/addWards.js'
  import addMask from './layers/addMask.js'
  import addTTC from './layers/addTTC.js'
  import addGround from './layers/addGround.js'
  import addRounds from './layers/addRounds.js'
  import mapboxgl from 'mapbox-gl'
  let title = 'Toronto transit stops by ward'
  mapboxgl.accessToken =
    'pk.eyJ1Ijoic3BlbmNlcm1vdW50' + 'YWluIiwiYSI6Inp5UVZEY3cifQ.dh-_SvkPgv9YOQZLG5ZHKg'
  onMount(async () => {
    const map = new mapboxgl.Map({
      container: 'map', // container ID
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

<Page {title} grow={true} padding={0}>
  <div id="map" />
  <!-- <div class="label">transit stations by ward, Oct 2022</div> -->
</Page>

<style>
  #map {
    min-width: 100%;
    min-height: 750px;
  }
</style>
