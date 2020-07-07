<script>
  import { Map, Shape } from 'somehow-maps'
  import { Head, Foot } from '../../components'
  import Road from './Road.svelte'
  import Sunset from './Sunset.svelte'
  // import roads from './roads.geo.js'
  import roads from './assets/roads.geo.json'
  // import tertiary from './assets/tertiary.geo.json'
  import parks from './assets/parks.geo.json'
  import { isDown } from './stores.js'
  let title = 'Custom Toronto streetmap'

  let eachRoad = roads.features.map(f => {
    return {
      type: 'FeatureCollection',
      features: [f],
    }
  })

  function onMouseDown() {
    isDown.set(true)
  }
  function onMouseUp() {
    isDown.set(false)
  }
</script>

<!-- 
// https://overpass-turbo.eu/
[out:json][timeout:25];
(
  way["highway"="secondary"]({{bbox}});
);
out body;
>;
out skel qt;
 -->

<Head {title} num="05" />
<div on:mousedown={onMouseDown} on:mouseup={onMouseUp}>
  <Sunset />
  <Map focus={roads} tilt={0}>
    {#each eachRoad as road}
      <Road shape={road} />
    {/each}
    <Shape shape={parks} fill="green" stroke="none" />
  </Map>
</div>
<Foot />
