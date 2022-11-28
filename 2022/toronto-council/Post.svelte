<script>
  import { Page } from '../../components/index.mjs'
  import byColor from './colors.js'
  import data from './data.js'
  import counts from './counts.js'
  export let title = 'Long-serving Toronto city councilors'
  export let sub = ''
  let minTerms = 2
</script>

<Page {title} {sub} height="1300" width="730">
  <div class="term legend" style="margin-bottom:5px; ">
    <div class="year" style="border:none;" />
    <div class="rel">
      <div class="label" style="left:3%; color:#735873;">Gloria Lindsay Luby</div>
      <div class="label" style="left:15.5%; color:#D68881;">Maria Augimeri</div>
      <div class="label" style="left:45%; color:#978BA3;">John Filion</div>
      <div class="label" style="left:49%; color:#2D85A8;">David Shiner</div>
      <div class="label" style="left:40%; color:#F2C0BB;">Joe Mihevc</div>
      <div class="label" style="left:69%; color:#335799;">Denzil Minnan-Wong</div>
      <div class="label" style="left:88%; color:#e6d7b3;">Raymond Cho</div>
    </div>
    <div class="aside" />
  </div>
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
          <div class="person highlight" style="border-left:7px solid {byColor[str]};" title={str} />
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
  <div class="term legend" style="margin-top: 1rem; align-items: flex-end;max-height: 40px">
    <div class="year" style="border:none;" />
    <div class="rel">
      <div class="label right" style="left:10%; color:#2D85A8;">Anthony Perruzza</div>
      <div class="label right" style="left:18%; color:#6699cc;">Frances Nunziata</div>
      <div class="label right" style="left:27%; color:#cc6966;">Gord Perks</div>
      <div class="label right" style="left:60%; color:#d8b3e6;">Paula Fletcher</div>
      <div class="label right" style="left:76%; color:#7f9c6c;">Michael Thompson</div>
      <div class="label right" style="left:88%; color:#275291;">Paul Ainslie</div>
    </div>
    <div class="aside" />
  </div>
</Page>

<style>
  .right {
    text-align: right !important;
    width: 70px !important;
  }
  .label {
    flex: 1;
    flex-wrap: nowrap;
    position: absolute;
    transform: rotate(-90deg) translateX(10px);
    width: 100px;
    height: 20px;
    text-align: left;
    /* border: 1px solid blue; */
    font-size: 12px;
    line-height: 1rem;
  }
  .rel {
    position: relative;
    width: 100%;
    flex: 1;
  }
  .legend {
    position: relative;
    /* min-width: 700px; */
    /* border: 1px solid grey; */
    /* min-height: 60px;
    margin-bottom: 17px;
    display: flex;
    margin-left: 40px;
    padding-right: 100px;
    flex-direction: row; */
    /* justify-content: flex-start; */
    /* justify-content: space-between; */
    /* align-items: flex-start; */
    /* text-align: left; */
    /* flex-wrap: nowrap;
    align-self: stretch; */
    /* box-sizing: border-box; */
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
    margin-left: 0px;
    margin-top: 0px !important;
  }
  .highlight {
    opacity: 1;
    margin-top: 0px !important;
    min-height: 120px;
    /* box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2); */
  }
  .aside {
    width: 100px;
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
</style>
