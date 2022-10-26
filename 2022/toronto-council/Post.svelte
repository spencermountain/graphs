<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import byColor from './colors.js'
  import data from './data.js'
  import counts from './counts.js'

  export let title = 'Long-serving Toronto city councilors'
  export let sub = ''
  let minTerms = 2
  let colorByCount = [
    null,
    'lightgrey', //1
    '#C4ABAB', //2
    '#978BA3', //3
    '#D68881', //4
    '#e6b3bc', //5
    '#cc6966', //6
    '#AB5850', //7
    '#914045', //8
  ]
</script>

<div>
  <Head {title} {sub} />
  <div class="container">
    <!-- <div class="term">
      <div class="year" style="text-align:left; text-decoration:underline;">(megacity)</div>
      <div style="flex-grow:1" />
    </div> -->
    {#each Object.keys(data) as year}
      {#if year === '2018'}
        <div style="margin-top:20px;" />
      {/if}
      {#if year === '2000'}
        <div style="margin-top:20px;" />
      {/if}
      <div class="term">
        <div class="year">{year}</div>
        {#each data[String(year)] as str}
          {#if counts[str] >= minTerms}
            <div
              class="person highlight"
              style="border-left:7px solid {byColor[str]};"
              title={str}
            />
          {:else}
            <div class="person" title={str} />
          {/if}
        {/each}
        <div class="aside">
          {#if year === '1997' || year === '2000' || year === '2018'}
            {data[String(year)].length} seats
            <br />
            ↓
          {/if}
        </div>
      </div>
    {/each}
  </div>
  <Foot {title} />
</div>

<style>
  .term {
    flex: 1;
    display: flex;
    flex-direction: row;
    /* justify-content: flex-start; */
    justify-content: space-between;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
    box-sizing: border-box;
  }
  .person {
    margin-top: 20px;
    min-height: 100px;
    height: 100%;
    border-left: 7px solid lightgrey;
    /* opacity: 0.5; */
    box-sizing: border-box;
    margin-left: 10px;
  }
  .highlight {
    opacity: 1;
    margin-top: 0px !important;
    min-height: 120px;
    /* box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2); */
  }
  .aside {
    min-width: 100px;
    max-width: 100px;
    color: grey;
    font-size: 12px;
  }
  .year {
    min-width: 45px;
    max-width: 45px;
    color: grey;
    font-size: 12px;
    text-align: left;
    align-self: flex-start;
    border-right: 1px solid lightsteelblue;
    min-height: 110px;
    /* margin-right: 10px; */
    /* text-decoration: underline; */
  }
  .container {
    margin: 3rem;
    padding: 3rem;
    /* border: 1px solid grey; */
    min-height: 800px;

    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: nowrap;
    align-self: stretch;
  }
</style>
