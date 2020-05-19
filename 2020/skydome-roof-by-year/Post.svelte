<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import {
    Timeline,
    Column,
    Line,
    colors,
    Ticks,
    Section,
    WideLabel,
    Now,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  import games from './data/games'
  let years = Object.keys(games) //.reverse()
  export let title = 'Skydome open-roof games, by year'
  export let sub = ''
  let start = 'March 20 2020'
  let end = 'Nov 8 2020'
  let height = 1200
  let num = '04'
  let d = new Date()
  let today = d.toISOString()
  let byYear = {}
  years.forEach(y => {
    y = String(y)
    let all = games[y].filter(g => g.is_open) || []
    let first = all.find(g => g.is_open) || {}
    byYear[y] = {
      first: first.date,
      count: all.length,
      total: games[y].length,
    }
  })
  console.log(byYear)
  let openColor = colors.colors.sky
  let closeColor = colors.colors.lighter
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
        <Column width="38px" label={year}>
          {#if year === '2020'}
            <Line
              width="3px"
              start={`2020-03-29`}
              end={today}
              size="12px"
              opacity="0.4"
              color="lightgrey" />
          {/if}
          {#each games[year] as game}
            <Line
              space="15px"
              width="15px"
              start={`2020-${game.date}`}
              duration="18 hours"
              size="14px"
              opacity="0.7"
              color={game.is_open ? openColor : closeColor} />
          {/each}
          <!-- first-game -->
          <Section date={'2020-' + byYear[year].first}>
            <div
              style="width:100%; position:relative; top:7px; height:1px;border-bottom:1px solid {openColor};" />
          </Section>
          <!-- <WideLabel date={byYear[year].first} label={byYear[year].first} /> -->
          <!-- bottom counts -->
          <Section date="Nov 1 2020">
            <b style="font-size:20px; color:{openColor};">{byYear[year].count}</b>
            <span
              style="font-size:11px; margin-left:17px; position:relative; top:-10px; color:{closeColor};">
              /{byYear[year].total}
            </span>
          </Section>
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
  <Foot {title} year="2020" num="04" />
</div>
