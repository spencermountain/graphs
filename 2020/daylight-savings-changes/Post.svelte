<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  export let title = 'Daylight savings time changes in 2020'
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
    colors,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  let year = 2019
  let start = 'Jan 1 '
  let end = 'Dec 31 '
  let height = 900
  let byTime = {}
  let zones = data.map((zone, i) => {
    zone.color = colors.combos.roma[i % 6]
    return zone
  })
  zones = zones.sort((a, b) => {
    if (a.offset > b.offset) {
      return -1
    } else if (a.offset < b.offset) {
      return 1
    }
    return 0
  })
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} num="02" />
  <div class="m3">
    <Timeline {start} {end} {height} {title}>
      <Ticks every="month" />
      <Line />
      <Now label="today" color="pink" />
      {#each zones as zone, i}
        {#each zone.times as time}
          <Column width="15px">
            <Line
              space="15px"
              start={time.start}
              end={time.end}
              color={zone.color}
              label={time.zones.length} />
          </Column>
        {/each}
      {/each}
    </Timeline>

  </div>
  <Foot {title} />
</div>
