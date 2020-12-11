<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import historical from './data/historical.js'
  export let title = ''
  export let sub = ''
  import { Vertical, Bar } from '/Users/spencer/mountain/somehow-barchart'
  import { Horizontal } from '/Users/spencer/mountain/somehow-slider'
  let byYear = {}
  historical.forEach(a => {
    let year = a[0].match(/[0-9]+/)[0]
    byYear[year] = byYear[year] || []
    byYear[year].push(a)
  })
  byYear = Object.keys(byYear).map(k => byYear[k])
  let index = 1
  // $: index = () => year
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .h8 {
    height: 18rem;
  }
  .year {
    color: grey;
    margin-top: 5rem;
  }
  .w80p {
    width: 50%;
  }
</style>

<div>
  <Head {title} {sub} num="28" />
  <div class="m3 h8 w80p">
    <Horizontal min={1} max={27} bind:value={index} />
    <!-- {#each byYear as months} -->
    <div class="year">{index + 1991}</div>

    <Vertical max="27177">
      {#each byYear[index] || [] as month}
        <Bar color="lightblue" value={month[1]} label={month[0]} />
      {/each}
    </Vertical>
    <!-- {/each} -->
  </div>
  <!-- <Foot {title} /> -->
</div>
