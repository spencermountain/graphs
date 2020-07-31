<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import spacetime from 'spacetime'
  import sunlight from 'spacetime-daylight'
  import { Round, Arc, Line, Label, Circle } from '/Users/spencer/mountain/somehow-circle/src'
  import { Globe, Graticule, Latitude, Countries } from '/Users/spencer/mountain/somehow-geo/src'
  export let title = ''
  export let sub = ''

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
  <Head {title} {sub} />
  <div class="m3">Sunrise + Sunset movement over a year</div>
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
        <Arc from={90} to={180} color="blue" width="5" radius="60" />
      </Round>
    </div>
  </div>
  <Foot {title} />
</div>
