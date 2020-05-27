<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import data from './data/roster.json'
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

  console.log(data)
  let years = Object.keys(data)
  // let year = data[2009]
  data[2009] = data[2009].sort((a, b) => {
    if (a[1] > b[1]) {
      return -1
    } else if (a < b) {
      return 1
    }
    return 0
  })
  data[2009] = data[2009].slice(0, 20)
  // console.log(year)
  let year = 2009
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
    height: 175px;
    width: 50px;
    border-right: 3px solid steelblue;
    text-align: left;
    position: relative;
  }
  .name {
    position: absolute;
    bottom: 60px;
    width: 130px;
    transform: rotate(-90deg);
    white-space: nowrap;
    left: 0px;
  }
</style>

<div>
  <Head {title} {sub} />
  <div class="m3">{title}</div>
  <div class="m3 row">
    <div class="year">{year}</div>
    {#each data[year] as a}
      <div class="player">
        <div class="name">{a[0]}</div>
      </div>
    {/each}
  </div>
  <Foot {title} />
</div>
