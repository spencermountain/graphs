<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  export let title = ''
  export let sub = ''
  export let num = '26'

  import getWeeks from './getWeeks'
  let byYear = []
  let year = 1998
  for (let i = 0; i < 30; i += 1) {
    year += 1
    byYear.push({ year: year, weeks: getWeeks(year) })
  }
  console.log(byYear)
  // console.log(getWeeks(year))
  // console.log(getWeeks(year + 1))

  const colors = {
    january: '#cc7066',
    febuary: '#2D85A8',
    march: '#c67a53',
    april: '#8BA3A2',
    may: '#dfb59f',
    june: '#C4ABAB',
    july: '#cc6966',
    august: '#275291',
    september: '#914045',
    october: '#8BA3A2',
    november: '#978BA3',
    december: '#2D85A8',
  }
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .row {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    flex-wrap: nowrap;
    align-self: stretch;
  }
  .col {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    flex-wrap: nowrap;
    align-self: stretch;
  }
  .week {
    font-size: 10px;
    margin-top: 2px;
    margin-left: 3px;
    height: 12px;
    background-color: steelblue;
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
    width: 50px;
  }
  .gap {
    height: 8px;
  }
  .year {
    font-size: 12px;
    color: grey;
  }
  .link {
    text-decoration: none;
  }
</style>

<div>
  <Head {title} {sub} {num} />
  <div class="m3">
    Weeks of the year, by their month
    <a class="link" href="https://en.wikipedia.org/wiki/ISO_week_date">
      <sup>[1]</sup>
    </a>
  </div>
  <div class="row m3">
    {#each byYear as year}
      <div class="col">
        <div class="year">{year.year}</div>
        {#each year.weeks as wk}
          {#if wk.gap === true}
            <div class="gap" />
          {:else}
            <div style="background-color:{colors[wk.month]}" class="week" title={wk.title} />
          {/if}
        {/each}
      </div>
    {/each}
  </div>
  <Foot {title} />
</div>
