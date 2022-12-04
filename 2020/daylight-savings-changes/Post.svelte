<script>
  import { Page } from '../../components/index.mjs'
  import spacetime from 'spacetime'
  import colors from 'spencer-color'
  export let title = 'Daylight Savings change dates, in 2020'
  export let sub = "'Eastern Standard' time"
  import data from './data'
  import {
    Timeline,
    Ticks,
    Line,
    WideLabel,
    Now,
    Column,
    // colors,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  let year = new Date().getFullYear()
  let start = 'Jan 1 '
  let end = 'Dec 31 '
  let height = 900
  let zones = data.map((zone, i) => {
    zone.color = colors.combos.roma[i % 6]
    zone.times.forEach((o) => {
      let a = o.start.split(/\//)
      let s = spacetime({ month: Number(a[0]), date: a[1], year: year })
      o.start = s.format('iso')

      a = o.end.split(/\//)
      s = spacetime({ month: Number(a[0]), date: a[1], year: year })
      o.end = s.format('iso')
    })
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

  // console.log(zones)
  let positives = []
  let negatives = []
  zones.forEach((z) => {
    if (z.offset < 0) {
      negatives.push(z)
    } else {
      positives.push(z)
    }
  })
  // add already
  positives.reverse()
  let already = 0
  positives.forEach((z) => {
    z.already = already
    z.times.forEach((t) => {
      already += t.zones.length
    })
  })
  already = 0
  negatives.forEach((z) => {
    z.already = already
    z.times.forEach((t) => {
      already += t.zones.length
    })
  })
  // negatives.reverse()
</script>

<Page {title} {sub}>
  <div>
    <div>Western Hemisphere</div>
    <div class="grey">(North/South America)</div>
    <Timeline {start} {end} {height}>
      <Ticks every="month" />
      <Now label="today" color="pink" />
      <WideLabel
        left={'100px'}
        width="50px"
        label={'Atlantic'}
        color="rgb(214, 136, 129)"
        date={'feb 20 ' + year}
      />
      <WideLabel
        left={'250px'}
        width="50px"
        label={'Eastern'}
        color="rgb(139, 163, 162)"
        date={'feb 20 ' + year}
      />
      <WideLabel
        left={'520px'}
        width="150px"
        label={'Central'}
        color="rgb(196, 171, 171)"
        date={'feb 20 ' + year}
      />
      <WideLabel
        left={'750px'}
        width="70px"
        label={'Mountain'}
        color="rgb(138, 132, 154)"
        date={'feb 20 ' + year}
      />
      <WideLabel
        left={'940px'}
        width="30px"
        label={'Pacific'}
        color="rgb(181, 176, 191)"
        date={'feb 20 ' + year}
      />

      {#each negatives as zone, i}
        {#if !String(zone.offset).match(/\./)}
          <WideLabel
            left={50 + zone.already * 13 + 'px'}
            width="30px"
            color={zone.color}
            label={zone.offset + 'h'}
            opacity="0.5"
            date={'march 7 ' + year}
          />
        {/if}
        {#each zone.times as time}
          {#each time.zones as name}
            <Column width="8px" margin="0px">
              <Line start={time.start} end={time.end} title={name} color={zone.color} />
            </Column>
          {/each}
        {/each}
      {/each}
    </Timeline>
  </div>

  <div class="m3">
    <div>Eastern Hemisphere</div>
    <div class="grey">(Asia/Africa)</div>
    <Timeline {start} {end} {height}>
      <Ticks every="month" />
      <Now label="today" color="pink" />
      <WideLabel
        left={'150px'}
        width="60px"
        label={'GMT'}
        color="rgb(139, 163, 162)"
        date={'march 20 ' + year}
      />
      <WideLabel
        left={'250px'}
        width="160px"
        label={'CET'}
        color="rgb(214, 136, 129)"
        date={'march 20 ' + year}
      />
      <WideLabel
        left={'550px'}
        width="90px"
        label={'EET'}
        color="rgb(215, 213, 210)"
        date={'march 20 ' + year}
      />
      {#each positives as zone, i}
        {#if !String(zone.offset).match(/\./)}
          <WideLabel
            left={50 + zone.already * 10 + 'px'}
            width="30px"
            color={zone.color}
            label={zone.offset + 'h'}
            date={'april 10 ' + year}
          />
        {/if}
        {#each zone.times as time}
          {#each time.zones as name}
            <Column width="6px" margin="2px">
              <Line start={time.start} end={time.end} title={name} color={zone.color} />
            </Column>
          {/each}
        {/each}
      {/each}
    </Timeline>
  </div></Page
>

<style>
  .m3 {
    margin: 3rem;
  }
  .grey {
    color: #d1d1d1;
  }
</style>
