<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import spacetime from 'spacetime'
  import sunlight from 'spacetime-daylight'
  import { Round, Arc, Line, Label, Circle } from '/Users/spencer/mountain/somehow-circle/src'
  // import { Globe, Graticule, Latitude, Countries } from '/Users/spencer/mountain/somehow-maps/src'
  // import { Latitude } from '/Users/spencer/mountain/somehow-slider/src/'
  import { Latitude } from 'somehow-slider'
  export let title = ''
  export let sub = ''
  let latitude = 37
  const fmt = function(v) {
    v -= 90
    v *= -1
    return v
  }
  spacetime.extend(sunlight)

  // let s = spacetime.today('Canada/Eastern')
  // ---year--
  // let hours = s.every('week', s.add(1, 'year'))
  // hours.forEach(d => {
  //   d = d.time('12:01pm')
  //   console.log(d.format('') + '   -   ' + d.sunPosition().altitude)
  // })
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} num={16} />
  <div class="m3">Sunrise + Sunset movement over a year</div>
  <div class="m3 col">
    <div class="right " style="width:300px;">
      <Latitude bind:value={latitude} />
    </div>

    <div class="col" style="max-width:800px;">
      <div class="right f2" style="margin-bottom:-50px;">{fmt(latitude)}°</div>
      <Round rotate="0" margin="10">
        <Arc from={-45} to={45} color="blue" width="5" radius="60" />
        <Arc from={135} to={225} color="blue" width="5" radius="60" />
      </Round>
    </div>
  </div>
  <Foot {title} />
</div>
