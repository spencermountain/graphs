<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import spacetime from 'spacetime'
  import linear from './scale'
  import sunlight from '/Users/spencer/mountain/spacetime-daylight/src'
  import { Round, Arc, Line, Label, Circle, Tick } from '/Users/spencer/mountain/somehow-circle/src'
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
  // spacetime.extend(geo)

  let scale = linear({
    // world: [-45, 45],
    world: [0, 90],
    minmax: [0, 1],
  })

  const findSunset = function(d) {
    d = d.time('3pm')
    // find sunset time
    for (let i = 0; i < 100; i += 1) {
      d = d.add(5, 'minute')
      if (d.sunPosition().altitude < 0) {
        break
      }
    }
    return d
  }
  const findSunRise = function(d) {
    d = d.time('3am')
    // find sunset time
    for (let i = 0; i < 100; i += 1) {
      d = d.add(5, 'minute')
      if (d.sunPosition().altitude > 0) {
        break
      }
    }
    return d
  }

  const calcYear = function(s) {
    let weeks = []
    s = s.startOf('year')
    let hours = s.every('week', s.endOf('year'))
    hours.forEach(d => {
      let set = findSunset(d)
      let rise = findSunRise(d)

      weeks.push({
        date: set.format('{month-short} {date}'),
        time: set.time(),
        sunset: set.sunPosition().azimuth,
        sunrise: rise.sunPosition().azimuth,
      })
    })
    return weeks
  }

  // let s = spacetime.today('Canada/Eastern')
  $: s = spacetime().in([fmt(latitude), 0])
  // let weeks = []
  $: weeks = calcYear(s)
  // console.log(weeks)
  // $weeks.subscribe(val => {
  //   console.log('change')
  //   return val
  // })

  // get current sunset azimout
  let now = spacetime.today('Canada/Eastern')
  now = findSunset(now)
  let currentSet = now.sunPosition().azimuth
  now = findSunRise(now)
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
  <Head {title} {sub} num={16} />
  <div class="m3">Sunrise + Sunset movement over a year</div>
  <div class="m3 col">
    <div style="width:300px;">
      <Latitude bind:value={latitude} />
    </div>

    <div style="max-width:1000px;">
      <div class="right f2 mt4" style="margin-bottom:-50px;">{fmt(latitude)}°</div>
      <Round width="500" height="500" rotate="-90" margin="10">
        <Tick text="N" angle="180" radius="45" size="2.6" color="lightblue" />
        <Tick text="S" angle="0" radius="45" size="2.6" color="lightblue" />
        <Tick text="E" angle="90" radius="45" size="2.6" color="lightblue" rotate="90" />
        <Tick text="W" angle="270" radius="45" size="2.6" color="lightblue" rotate="90" />
        <!-- <Arc from={45} to={90 + 45} color="blue" width="5" radius="60" /> -->
        <!-- <Arc from={180} to={270} color="blue" width="5" radius="60" /> -->
        <!-- <Circle color="blue" width="1" radius="50" /> -->
        {#each weeks as week, i}
          <Arc from={week.sunset} to={week.sunset + 0.5} color="pink" width="8" radius="52" />
          <Arc from={week.sunrise} to={week.sunrise + 0.5} color="yellow" width="8" radius="52" />
          {#if i === 50 || i === 24 || i === 10}
            <Tick
              at={week.sunset}
              color="light"
              text={week.date}
              radius="62"
              rotate="90"
              align={i === 24 ? 'left' : 'right'} />
            <Tick
              at={week.sunrise}
              color="light"
              text={week.date}
              radius="69"
              rotate="90"
              align={i === 24 ? 'left' : 'right'} />
          {/if}
        {/each}

        <!-- draw today -->
        <Line radius="10" length="40" angle={currentSet} color="lightblue" width="0.2" />
        <Line radius="10" length="40" angle={currentRise} color="lightblue" width="0.2" />
        <Arc
          radius="10"
          length="40"
          from={currentRise}
          to={currentSet}
          color="lightblue"
          width="22" />
      </Round>
    </div>
  </div>
  <Foot {title} />
</div>
