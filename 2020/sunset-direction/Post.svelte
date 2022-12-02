<script>
  import { Page } from '../../components/index.mjs'
  import spacetime from 'spacetime'
  import { calcYear } from './calc'
  import daylight from 'spacetime-daylight'
  import { Round, Arc, Line, Tick } from '/Users/spencer/mountain/somehow-circle/src'
  // import { Latitude } from 'somehow-slider'
  // import { lat, ticks } from './store'
  import { getSunSet, getSunRise } from './calc'
  let title = `Sunrise + Sunset direction`
  spacetime.extend(daylight)

  let lat = 37

  const fmt = function (v) {
    v -= 90
    v *= -1
    return v
  }
  // get current sunset azimout
  let now = spacetime.today('Canada/Eastern')
  now = getSunSet(now, fmt(lat))
  let currentSet = now.sunPosition().azimuth
  now = getSunRise(now, fmt(lat))
  let currentRise = now.sunPosition().azimuth

  const change = function () {
    console.log('calc', lat)
    now = getSunSet(now, fmt(lat))
    currentSet = now.sunPosition().azimuth
    now = getSunRise(now, fmt(lat))
    currentRise = now.sunPosition().azimuth
    console.log(currentRise)
  }
  let ticks = calcYear(lat)
  change()
</script>

<Page {title} grow={true} max={1100} sub="at {lat}°">
  <input type="range" bind:value={lat} min="0" max="90" on:change={change} />
  <!-- <div>{currentSet}</div> -->
  <!-- <div class="right f2 mt4" style="margin-bottom:-50px;">{fmt($lat)}°</div> -->
  <Round width="500" height="500" rotate="-90" margin="10">
    <Tick text="N" angle="180" radius="45" size="2.6" color="lightblue" rotate="0" />
    <Tick text="S" angle="0" radius="45" size="2.6" color="lightblue" rotate="0" />
    <Tick text="E" angle="90" radius="45" size="2.6" color="lightblue" />
    <Tick text="W" angle="270" radius="45" size="2.6" color="lightblue" />
    <!-- sunrise/sunset ticks -->
    {#each ticks as week, i (week.id)}
      <Arc from={week.sunset} to={week.sunset + 0.5} color="pink" width="8" radius="52" />
      <Arc from={week.sunrise} to={week.sunrise + 0.5} color="yellow" width="8" radius="52" />
      {#if i === 50 || i === 24 || i === 10}
        <Tick
          at={week.sunset}
          color="light"
          text={week.date}
          radius="62"
          align={i === 24 ? 'left' : 'right'}
        />
        <Tick
          at={week.sunrise}
          color="light"
          text={week.date}
          radius="69"
          align={i === 24 ? 'left' : 'right'}
        />
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
      width="6"
    />
    <!-- <Label
          text={now.format('{month-short} {date}')}
          radius="10"
          angle="180"
          align="middle"
          color="lightblue" /> -->
  </Round>
</Page>

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
