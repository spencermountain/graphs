<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import spacetime from 'spacetime'
  import sunlight from '/Users/spencer/mountain/spacetime-daylight/src'
  import { Round, Arc, Line, Label, Circle, Tick } from '/Users/spencer/mountain/somehow-circle/src'
  import { Latitude } from 'somehow-slider'
  import { lat, ticks } from './store'
  import { getSunSet, getSunRise, calcYear } from './calc'
  spacetime.extend(sunlight)

  const fmt = function(v) {
    v -= 90
    v *= -1
    return v
  }

  // ticks.subscribe(el => {
  //   console.log('updated')
  //   console.log()
  //   return el
  // })
  // let s = spacetime().in([fmt($lat), 0])
  // let weeks = calcYear(s)

  // get current sunset azimout
  let now = spacetime.today('Canada/Eastern')
  now = getSunSet(now, fmt($lat))
  let currentSet = now.sunPosition().azimuth
  now = getSunRise(now, fmt($lat))
  let currentRise = now.sunPosition().azimuth
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .mt4 {
    margin-top: 4rem;
  }
  .col {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
  }
</style>

<div>
  <Head num={19} />
  <div class="m3">Sunrise + Sunset direction</div>
  <div class="m3 col">
    <!-- {#each $ticks as week, i (week.id)}
      <div>{week.sunset}</div>
    {/each} -->
    <!-- <pre>{$ticks.map(s => s.sunset)}</pre> -->
    <div style="width:300px;">
      <Latitude bind:value={$lat} />
    </div>

    <div style="max-width:1000px;">
      <!-- <div class="right f2 mt4" style="margin-bottom:-50px;">{fmt($lat)}°</div> -->
      <Round width="500" height="500" rotate="-90" margin="10">
        <Tick text="N" angle="180" radius="45" size="2.6" color="lightblue" rotate="0" />
        <Tick text="S" angle="0" radius="45" size="2.6" color="lightblue" rotate="0" />
        <Tick text="E" angle="90" radius="45" size="2.6" color="lightblue" />
        <Tick text="W" angle="270" radius="45" size="2.6" color="lightblue" />
        <!-- sunrise/sunset ticks -->
        {#each $ticks as week, i (week.id)}
          <Arc from={week.sunset} to={week.sunset + 0.5} color="pink" width="8" radius="52" />
          <Arc from={week.sunrise} to={week.sunrise + 0.5} color="yellow" width="8" radius="52" />
          {#if i === 50 || i === 24 || i === 10}
            <Tick
              at={week.sunset}
              color="light"
              text={week.date}
              radius="62"
              align={i === 24 ? 'left' : 'right'} />
            <Tick
              at={week.sunrise}
              color="light"
              text={week.date}
              radius="69"
              align={i === 24 ? 'left' : 'right'} />
          {/if}
        {/each}

        <!-- draw inside arcs -->
        <Line radius="5" length="40" angle={currentSet} color="lightblue" width="0.2" />
        <Line radius="5" length="40" angle={currentRise} color="lightblue" width="0.2" />
        <Arc
          radius="15"
          length="40"
          from={currentRise}
          to={currentSet}
          color="lightblue"
          opacity="0.7"
          width="6" />
        <!-- <Label
          text={now.format('{month-short} {date}')}
          radius="10"
          angle="180"
          align="middle"
          color="lightblue" /> -->
      </Round>
    </div>
  </div>
  <Foot />
</div>
