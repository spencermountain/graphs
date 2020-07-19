<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import { Round, Arc, Line, Label, Circle } from '/Users/spencer/mountain/somehow-circle/src'

  import { Globe, Graticule, Latitude, Countries } from '/Users/spencer/mountain/somehow-geo/src'
  export let title = ''
  export let sub = ''
  const rotate = 50
  const lat = 40
  const longToDec = function(arr) {
    arr.forEach(a => {
      // -180,180 -> 0-360
      a[1] += 180 - rotate
      if (a[2]) {
        a[2] += 180 - rotate
      }
    })
  }

  // at 40deg
  let points = [
    ['New York', -73],
    ['Barcelona', -8.5],
    ['Istanbul', 28],
    ['Tehran', 50],
    ['Beijing', 116],
    ['Seoul', 126],
    ['Tokyo', 138],
    ['Salt Lake City', -112],
    ['Denver', -106],
    ['St Louis', -88],
  ]
  let oceans = [['Atlantic', -69, -9], ['Pacific', 144, 236]]
  let continents = [['America', -123, -70], ['Eurasia', -8, 143]] //-143
  longToDec(oceans)
  longToDec(continents)
  longToDec(points)
  console.log(oceans)
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div class="main">
  <Head {title} {sub} num="16" />
  <div class="m3">Eath as a pie-chart</div>
  <div class="main col">
    <div class="right " style="width:300px;">
      <Globe tilt={-10} rotate="30">
        <Graticule />
        <Countries color="lightgrey" />
        <Latitude at={40} width="8" />
      </Globe>
    </div>

    <div class="col" style="max-width:800px;">
      <div class="right f2" style="margin-bottom:-50px;">{40}°</div>
      <Round rotate="0" margin="10">
        {#each oceans as a}
          <Arc from={a[1]} to={a[2]} color="blue" width="5" label={a[0]} radius="60" />
        {/each}
        {#each continents as a}
          <Arc from={a[1]} to={a[2]} color="orange" width="5" radius="60" />
        {/each}
        <!-- <Circle radius="70" /> -->
        <!-- <Line length="70" angle="90" /> -->
        {#each points as a}
          <Label angle={a[1]} radius="68" text={a[0]} color="grey" align="right" />
        {/each}
      </Round>
    </div>
  </div>

  <Foot {title} />
</div>
