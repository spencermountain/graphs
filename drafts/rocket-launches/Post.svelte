<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'

  import {
    Timeline,
    Column,
    Line,
    colors,
    Ticks,
    Dash,
  } from '/Users/spencer/mountain/somehow-timeline/src'

  let year = new Date().getFullYear()
  let start = 'Jan 1 1950'
  let end = 'Dec 31 2030'
  let height = 3500
  export let title = 'Rocket Launches'

  import atlas from './data/atlas.json'
  import saturn5 from './data/saturn5.json'
  import china from './data/china.json'
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} num="07" />
  <div class="m3">
    <Timeline {start} {end} {height} {title}>
      <Ticks every="decade" />
      <Ticks every="year" size="8px" color="lightgrey" underline={false} />

      <Column width="75px" label="Saturn 5">
        {#each saturn5 as rocket}
          <Dash start={rocket.date} color="blue" opacity="0.5" dotted={false} />
        {/each}
      </Column>

      <Column width="75px" label="Atlas">
        {#each atlas as rocket}
          <Dash start={rocket.date} color="rose" opacity="0.5" dotted={false} />
        {/each}
      </Column>

      <Column width="75px" label="China">
        {#each china as rocket}
          <Dash start={rocket.date} color="orange" opacity="0.5" dotted={false} />
        {/each}
      </Column>
    </Timeline>
  </div>
  <Foot {title} />
</div>
