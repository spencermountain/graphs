<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import {
    Timeline,
    Column,
    Line,
    Ticks,
    WideLabel,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'CBC radio 1 schedule'
  export let sub = ''
  let start = 'Jan 1 2020 5:00am'
  let end = 'Jan 1 2020 10:00pm'
  let height = '800'
  let days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  let weekdays = [
    { time: '6:00am', name: 'Metro Morning', color: 'blue', end: '8:30am' },
    { time: '8:30am', name: 'The Current', color: 'red', end: '10:00am' },
    { time: '10:00am', name: 'Q', color: 'purple', end: '11:30am' },
    { time: '12:00pm', name: 'Ontario Today', color: 'blue', end: '1:30pm' },
    { time: '2:00pm', name: 'Podcast Playlist', color: 'purple', end: '3:00pm' },
    { time: '3:00pm', name: 'Here and Now', color: 'blue', end: '6:00pm' },
    { time: '6:30pm', name: 'As it Happens', color: 'red', end: '7:30pm' },
    { time: '8:00pm', name: 'Ideas', color: 'red', end: '9:00pm' },
  ]
  let saturday = [
    { time: '6:00am', name: 'Fresh Air', color: 'pink', end: '9:00am' },
    { time: '9:00am', name: 'The house', color: 'red', end: '10:00am' },
    { time: '10:00am', name: 'Day 6', color: 'red', end: '11:00am' },
    { time: '11:30am', name: 'Under the Influence', color: 'purple', end: '12:00pm' },
    { time: '12:00pm', name: 'Quarks & Quarks', color: 'purple', end: '1:00pm' },
    { time: '1:00pm', name: 'The Dose', color: 'purple', end: '1:30pm' },
    { time: '1:30pm', name: 'The Debaters', color: 'purple', end: '2:00pm' },
    { time: '2:00pm', name: 'Podcast Playlist', color: 'purple', end: '3:00pm' },
    { time: '3:00pm', name: 'Now or Never', color: 'purple', end: '4:00pm' },
    { time: '4:00pm', name: 'The Next Chapter', color: 'purple', end: '5:00pm' },
    { time: '5:00pm', name: 'Big City Small World', color: 'blue', end: '6:00pm' },
    { time: '7:00pm', name: 'Vinyl Tap', color: 'red', end: '9:00pm' },
  ]
  let sunday = [
    { time: '6:00am', name: 'Fresh Air', color: 'pink', end: '9:00am' },
    { time: '9:00am', name: 'Sunday Edition', color: 'red', end: '10:30am' },
    { time: '10:30am', name: 'What On Earth', color: 'purple', end: '11:00am' },
    { time: '11:00am', name: 'More', color: 'purple', end: '12:00am' },
    { time: '12:00pm', name: 'Vinyl Cafe', color: 'purple', end: '1:00pm' },
    { time: '1:00pm', name: 'Spark', color: 'purple', end: '2:00pm' },
    { time: '2:00pm', name: 'Tapestry', color: 'purple', end: '3:00pm' },
    { time: '3:00pm', name: 'Writers & Company', color: 'blue', end: '4:00pm' },
    { time: '4:00pm', name: 'Cross Country Checkup', color: 'purple', end: '6:00pm' },
    { time: '7:00pm', name: 'Unreserved', color: 'red', end: '8:00pm' },
  ]
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .light {
    color: grey;
  }
  .ml1 {
    margin-left: 2rem;
  }
</style>

<div>
  <Head {title} {sub} num={'15'} />
  <div class="m3">
    {title}
    <div class="i light ml1">(ontario)</div>
  </div>
  <div class="m3">
    <Timeline {start} {end} {height}>
      <Ticks every="hour" />
      {#each days as day, i}
        <Column width="150px" title={day}>
          {#if i === 5}
            {#each saturday as p}
              <Line
                start={'Jan 1 2020 ' + p.time}
                end={'Jan 1 2020 ' + p.end}
                label={p.name}
                margin={5}
                opacity="0.5"
                color={p.color} />
            {/each}
          {:else if i === 6}
            {#each sunday as p}
              <Line
                start={'Jan 1 2020 ' + p.time}
                end={'Jan 1 2020 ' + p.end}
                label={p.name}
                margin={5}
                opacity="0.5"
                color={p.color} />
            {/each}
          {:else}
            {#each weekdays as p}
              <Line
                start={'Jan 1 2020 ' + p.time}
                end={'Jan 1 2020 ' + p.end}
                label={p.name}
                margin={5}
                opacity="0.5"
                color={p.color} />
            {/each}
          {/if}

        </Column>
      {/each}
      <WideLabel date={'Jan 1 2020 12:00pm'} color="#e4e4e4" />
    </Timeline>
  </div>
  <Foot {title} />
</div>
