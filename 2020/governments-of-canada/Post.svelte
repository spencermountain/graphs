<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import data from './data'
  import {
    Timeline,
    Axis,
    Line,
    Column,
    Point,
    Era,
    Dash,
    Ticks,
    Label,
    Text,
    Horizontal,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'Governments of Canada'
  export let sub = ''
</script>

<style>
  .m3 {
    margin: 3rem;
    width: 100%;
  }
</style>

<div>
  <Head {title} {sub} num="14" />
  <div class="m3">
    <Timeline start="1867" end="Dec 30 2020" height="1400">
      <Axis />
      <Column width="400px">
        {#each data as row}
          <Line
            start={row.start}
            end={row.end}
            width="400px"
            title={row.party}
            label={row.party}
            hide={true}
            color={row.party === 'Conservative' ? 'blue' : 'red'}
            opacity={row.majority ? 1 : 0.5} />
        {/each}
      </Column>
      <Column>
        {#each data as row}
          <Text
            start={row.start}
            end={row.end}
            align={'left'}
            size={'8px'}
            label={row.leader}
            color={row.party === 'Conservative' ? 'blue' : 'red'}
            opacity={row.majority ? 1 : 0.5} />
        {/each}
      </Column>
    </Timeline>
  </div>
  <Foot {title} />
</div>
