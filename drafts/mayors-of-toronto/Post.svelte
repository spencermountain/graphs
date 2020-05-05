<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import {
    Timeline,
    Column,
    Line,
    colors,
    Ticks,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  import mayors from './data'
  let year = new Date().getFullYear()
  let start = 'Jan 1 1900'
  let end = 'Dec 31 2030'
  let height = 1800
  export let title = 'Mayors of Toronto'
  export let sub = ''
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} />
  <div class="m3">
    <Timeline {start} {end} {height} {title}>
      <Ticks every="decade" />
      <Ticks every="year" size="8px" color="lightgrey" underline={false} />

      <Column width="125px">
        {#each mayors as mayor, i}
          <Line
            space="15px"
            width="3px"
            start={mayor[1]}
            size="14px"
            end={mayor[2]}
            color={colors.combos.dupont[i % 6]}
            label={mayor[0]} />
        {/each}
      </Column>
      <!-- population -->
      <!-- <Column width="200px">
          <Area data={population} width="120" color="slategrey" opacity="0.6" />
        </Column> -->
    </Timeline>
  </div>
  <Foot {title} />
</div>
