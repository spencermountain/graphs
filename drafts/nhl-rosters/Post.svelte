<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import data from './data/cleanup.json'
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

  let years = Object.keys(data)
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
    {#each years as year, i}
      <div class="row">
        <div class="year">{year}</div>
        {#each data[year] as a, o}
          {#if years[i - 1] && data[years[i - 1]][o] === a}
            <div class="player">
              <div class="name">{''}</div>
            </div>
          {:else}
            <div class="player">
              <div class="name">{a}</div>
            </div>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
  <Foot {title} />
</div>
