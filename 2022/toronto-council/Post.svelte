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
  <Head {title} {sub} num="04" />
  <div class="container">
    <div class="legend">
      <div class="label" style="left:45%; color:#978BA3;">John Filion</div>
      <div class="label" style="left:40%; color:#F2C0BB;">Joe Mihevc</div>
      <div class="label" style="left:67%; color:#335799;">Denzil Minnan-Wong</div>
    </div>
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
    <div class="legend" style="margin-top: 2rem;">
      <div class="label" style="left:20%; color:#6699cc;">Frances Nunziata</div>
      <div class="label" style="left:58%; color:#d8b3e6;">Paula Fletcher</div>
      <div class="label" style="left:71%; color:#7f9c6c;">Michael Thompson</div>
      <div class="label" style="left:27%; color:#cc6966;">Gord Perks</div>
      <div class="label" style="left:82%; color:#275291;">Paul Ainslie</div>
    </div>
  </div>
  <Foot {title} />
</div>

<style>
  .label {
    flex: 1;
    flex-wrap: nowrap;
    position: absolute;
    transform: rotate(-90deg);
    width: 100px;
    height: 20px;
    text-align: left;
    /* border: 1px solid blue; */
    font-size: 12px;
    line-height: 1rem;
  }
  .legend {
    position: relative;
    width: 100%;

    min-height: 60px;
    margin-bottom: 17px;
  }
  .term {
    flex: 1;
    display: flex;
    flex-direction: row;
    /* justify-content: flex-start; */
    justify-content: space-between;
    align-items: center;
    text-align: center;
    flex-wrap: nowrap;
    align-self: stretch;
    box-sizing: border-box;
    min-width: 700px;
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
