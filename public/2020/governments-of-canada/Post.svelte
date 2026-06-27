<script>
  import { Page } from '../../components/index.mjs'
  import data from './data'
  import {
    Timeline,
    Axis,
    Line,
    Column,
    Text,
  } from '/Users/spencer/mountain/somehow-timeline/src/index.mjs'
  export let title = 'Governments of Canada'
  export let sub = 'since confederation'
</script>

<Page {title} {sub}>
  <Timeline start="1867" end="Dec 30 2025" height="1400">
    <Axis />
    <Column width="400px">
      {#each data as row}
        <Line
          start={row.start}
          end={row.end}
          width="400px"
          title={row.leader}
          label={row.party}
          hide={true}
          color={row.party === 'Conservative' ? 'blue' : 'red'}
          opacity={row.majority ? 1 : 0.5}
        />
      {/each}
    </Column>
    <!-- <Column>
      {#each data as row}
        <Text
          start={row.start}
          end={row.end}
          align={'left'}
          size={'8px'}
          label={row.leader}
          color={row.party === 'Conservative' ? 'blue' : 'red'}
          opacity={row.majority ? 1 : 0.5}
        />
      {/each}
    </Column> -->
  </Timeline>
</Page>

<style>
</style>
