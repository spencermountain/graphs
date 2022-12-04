<script>
  import { Page } from '../../components/index.mjs'
  import { Vertical, Bar } from '/Users/spencer/mountain/somehow-barchart/src'
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

<Page {title} {sub} grow={true} max={800} min={350}>
  <div class="all" style="">
    {#each cities as k}
      <div class="mt2 ">
        <div class="slate">{k}:</div>
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
</Page>

<style>
  .all {
    margin: 1rem;
  }
  .mt2 {
    margin-top: 1rem;
    margin-bottom: 7rem;
    text-align: left;
  }
  .slate {
    color: #8c8c88;
    display: inline;
    margin-left: 1rem;
    border-bottom: 2px solid #8c8c88;
  }
  .bl {
    margin-top: 10px;
  }
</style>
