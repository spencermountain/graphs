<script>
  import { Page } from '../../components/index.mjs'
  import byCol from './data/byCol2.json'
  import { Timeline, Column, Line, Ticks } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'Toronto Maple Leafs roster changes'
  export let sub = ''
  let start = 'nov 1 2008'
  let end = 'dec 31 2022'
  let height = '1500'
  // let cols = colors.combos.yukon.concat(colors.combos.bloor).concat(colors.combos.roma)
  // let cols = [].concat(colors.combos.yukon, colors.combos.yukon, colors.combos.yukon)
  // cols = []
  // let years = Object.keys(data)
  const colors = {
    2009: 'blue',
    2010: 'red',
    2011: 'fuscia',
    2012: 'navy',
    2013: 'blue',
    2014: 'red',
    2015: 'fuscia',
    2016: 'navy',
    2017: 'blue',
    2018: 'red',
    2019: 'fuscia',
    2020: 'navy',
    2021: 'blue',
    2022: 'red',
    2023: 'fuscia',
    // 2011: 'green',
    // 2012: 'suede',
    // 2013: 'pink',
    // 2014: 'rouge',
    // 2015: '#6699cc',
    // 2016: 'olive',
    // 2017: 'purple',
    // 2018: '#cc7066',
    // 2019: '#F2C0BB',
    // 2020: '#a3a5a5',
    // '#C4ABAB',
    // '#8C8C88',
    // '#705E5C',
    // '#2D85A8',
    // '#e6d7b3',
    // '#cc7066',
  }

  // navy  #6accb2
  // light #cc7066
  // red #cc7066
  // purple #F2C0BB
</script>

<Page {title} {sub} num={'09'}>
  <div style="overflow-y:hidden">
    <Timeline {start} {end} {height}>
      <Ticks every="decade" {start} {end} />
      <Ticks every="year" {start} {end} size="8px" color="lightgrey" underline={false} />
      {#each byCol as list, i}
        <Column width="25px">
          {#each list as player, i}
            <Line
              start={'jan 1 ' + player.start}
              duration={player.years * 12 + ' months'}
              label={player.name}
              title={player.start + '-' + player.years}
              rotate={true}
              margin={5}
              opacity="0.5"
              color={colors[player.start] || 'blue'}
            />
          {/each}
        </Column>
      {/each}
    </Timeline>
  </div>
</Page>

<style>
</style>
