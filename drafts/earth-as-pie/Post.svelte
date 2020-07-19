<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import { Round, Arc, Line, Label, Circle } from '/Users/spencer/mountain/somehow-circle/src'

  import { Globe, Graticule, Latitude, Countries } from '/Users/spencer/mountain/somehow-geo/src'
  export let title = ''
  export let sub = ''
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
  let arcs = [['Atlantic', -69, -9], ['Pacific', 142, -124]]
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div class="main">
  <Head {title} {sub} num="16" />
  <div class="m3">Eath as pie-chart</div>
  <div class="main col">

    <div class="right " style="width:300px;">
      <Globe tilt={-10} rotate="30">
        <Graticule />
        <Countries color="lightgrey" />
        <Latitude at={40} width="8" />
      </Globe>
    </div>

    <div style="max-width:800px;">
      <Round rotate="0" margin="10">
        <Arc from="-45" to="45" color="blue" width="8" />
        <Arc from="135" to="225" color="orange" width="8" />
        <Arc from="-10" to="-5" color="red" width="8" />
        <Circle radius="70" />
        <Line length="70" />
        <Label angle="20" radius="70" text="foobar" color="white" />
        <Label angle="40" radius="70" text="foobar" color="white" />
        <Label angle="60" radius="70" text="foobar" color="white" />
      </Round>
    </div>
  </div>

  <Foot {title} />
</div>
