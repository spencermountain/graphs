<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import { Horizontal, Vertical, Bar } from '/Users/spencer/mountain/somehow-barchart/src'
  import data from './data'
  export let title = 'Snowfall in Canada'
  export let sub = ''
  let cities = Object.keys(data)
  const max = 72
  const months = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ]
</script>

<style>
  .m3 {
    margin-left: 5rem;
  }
  .mt2 {
    margin-top: 3rem;
  }
  .slate {
    color: #8c8c88;
    display: inline;
    border-bottom: 2px solid #8c8c88;
  }
  .bl {
    margin-top: 10px;
  }
</style>

<div>
  <Head {title} {sub} num="24" />
  <div class="m3" style="max-width:800px;">
    {#each cities as k}
      <div class="mt2 ">
        <div class="slate">{k}</div>
        <div class="bl">
          <Vertical height="200px" max={1} axis={true}>
            {#each data[k] as num, i}
              <Bar color="blue" value={num / max} label={months[i]} title={num + 'cm'} />
            {/each}
          </Vertical>
        </div>
      </div>
    {/each}

  </div>
  <Foot />
</div>
