<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  export let title = 'Daylight-savings time changes'
  export let sub = "'Eastern Standard' time"
  import data from './data'
  import {
    Timeline,
    Ticks,
    Line,
    WideLabel,
    Now,
    Column,
    Label,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  let year = 2019
  let start = 'Jan 1 '
  let end = 'Dec 31 '
  let height = 900

  let byTime = {}
  data.forEach(a => {
    // a[1] += `/${year}`
    // a[2] += `/${year}`
    let time = a[1] + ':' + a[2]
    byTime[time] = byTime[time] || []
    byTime[time].push(a[0])
  })
  let zones = Object.keys(byTime).map(k => {
    let t = k.split(/:/)
    return {
      start: t[0],
      end: t[1],
      zones: byTime[k],
      label: byTime[k].length == 1 ? byTime[k][0].split(/\//)[1] : byTime[k].length + ' zones',
    }
  })
  console.log(zones)
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} />
  <div class="m3">
    <Timeline {start} {end} {height} {title}>
      <Ticks every="month" />
      <Line />
      <Now label="today" color="pink" />
      {#each zones as zone, i}
        <Column width="15px">
          <Line space="15px" start={zone.start} end={zone.end} color="green" label={zone.label} />
        </Column>
      {/each}
    </Timeline>

  </div>
  <Foot {title} />
</div>
