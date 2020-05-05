<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import {
    Timeline,
    Column,
    Line,
    colors,
    Ticks,
    Now,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  import games from './data/games'
  let years = Object.keys(games).reverse()
  export let title = 'Skydome roof by year'
  export let sub = ''
  let start = 'March 20 2020'
  let end = 'Nov 8 2020'
  let height = 1200
  let num = '04'
  let d = new Date()
  let today = d.toISOString()
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} {num} />
  <div class="m3">
    <Timeline {start} {end} {height} {title}>
      <!-- <Now color="none" label="today" /> -->
      <Column width="50px">
        <Ticks every="month" />
      </Column>
      <Column width="75px">
        <Ticks every="week" size="8px" color="lightgrey" underline={false} />

      </Column>

      {#each years as year, i}
        <Column width="85px" label={year}>
          {#if year === '2020'}
            <Line
              space="15px"
              width="3px"
              start={`2020-03-29`}
              end={`2020-07-20`}
              size="14px"
              label="covid"
              color={'yellow'} />
          {/if}
          {#each games[year] as game}
            <Line
              space="15px"
              width="3px"
              start={`2020-${game.date}`}
              duration="18 hours"
              size="14px"
              color={game.is_open ? 'steelblue' : 'lightsteelblue'} />
          {/each}
        </Column>
      {/each}
      <!-- <Column width="25px">
        <Line
          width="3px"
          start={today}
          duration="3 days"
          size="10px"
          label="(today)"
          opacity="0.7"
          color="rose" />
      </Column> -->
    </Timeline>
  </div>
  <Foot {title} />
</div>
