<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import byCol from './data/byCol.json'
  import {
    Timeline,
    Column,
    Line,
    colors,
    Ticks,
    Bar,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'NHL roster changes'
  export let sub = ''
  let start = 'jan 1 2009'
  let end = 'dec 31 2019'
  let height = '1500'
  let cols = colors.combos.juno.concat(colors.combos.bloor).concat(colors.combos.roma)
  // let years = Object.keys(data)
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .row {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: nowrap;
    align-self: stretch;
  }
  .player {
    font-size: 14px;
    min-height: 175px;
    max-height: 175px;
    min-width: 50px;
    max-width: 50px;
    border-right: 3px solid steelblue;
    text-align: left;
    position: relative;
  }
  .name {
    position: absolute;
    bottom: 60px;
    width: 130px;
    height: 12px;
    transform: rotate(-90deg);
    white-space: nowrap;
    left: 0px;
  }
  .year {
    width: 50px;
  }
</style>

<div>
  <Head {title} {sub} />
  <div class="m3">{title}</div>
  <div class="m3">
    <Timeline {start} {end} {height}>
      <Ticks every="decade" />
      <Ticks every="year" size="8px" color="lightgrey" underline={false} />
      {#each byCol as list, i}
        <Column width="75px">
          {#each list as player, i}
            <Line
              start={'jan 1 ' + player.start}
              duration={player.years + ' years'}
              label={player.name} />
          {/each}
        </Column>
      {/each}
    </Timeline>
  </div>
  <Foot {title} />
</div>
