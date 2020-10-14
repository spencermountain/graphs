<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import data from './data'
  import { Timeline, Axis, Column, Dash, Text } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'Stanley Cup wins in Canada'
  export let sub = ''
  let byTeam = {}
  data.forEach(row => {
    if (row.team) {
      byTeam[row.team] = byTeam[row.team] || []
      byTeam[row.team].push(row.year)
    }
  })
  console.log(byTeam)
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} num="23" />
  <div class="m3">
    <Timeline start="1960" end="today" height="700">
      <Axis />
      <Column>
        <Text color="sky" label="Vancouver" date="1960" underline={true} />
        <!-- {#each byTeam.vancouver as year}
          <Dash date={'jan 1 ' + year} color="sky" height="10px" />
        {/each} -->

      </Column>
      <Column>
        <Text color="#d48481" label="Calgary" date="1960" underline={true} />
        {#each byTeam.calgary as year}
          <Dash date={'jan 1 ' + year} color="#d48481" height="10px" title={year} />
        {/each}
      </Column>
      <Column>
        <Text color="silver" label="Edmonton" date="1960" underline={true} />
        {#each byTeam.edmonton as year}
          <Dash date={'jan 1 ' + year} color="silver" height="10px" title={year} />
        {/each}
      </Column>
      <Column>
        <Text color="grey" label="Winnipeg" date="1960" underline={true} />
        <!-- {#each byTeam.winnipeg as year}
          <Dash date={'jan 1 ' + year} color="grey" height="10px" />
        {/each} -->
      </Column>
      <Column>
        <Text color="blue" label="Toronto" date="1960" underline={true} />
        {#each byTeam.toronto as year}
          <Dash date={'jan 1 ' + year} color="blue" height="10px" title={year} />
        {/each}
      </Column>
      <Column>
        <Text color="orange" label="Ottawa" date="1960" underline={true} />
        <!-- {#each byTeam.ottawa as year}
          <Dash date={'jan 1 ' + year} color="orange" height="10px" />
        {/each} -->
      </Column>
      <Column>
        <Text color="red" label="Montreal" date="1960" underline={true} />
        {#each byTeam.montreal as year}
          <Dash date={'jan 1 ' + year} color="red" height="10px" title={year} />
        {/each}
      </Column>
      <Column>
        <Text color="#7dd1d1" label="Quebec" date="1960" underline={true} />
        <!-- {#each byTeam.ottawa as year}
          <Dash date={'jan 1 ' + year} color="orange" height="10px" />
        {/each} -->
      </Column>
    </Timeline>
  </div>
  <Foot {title} />
</div>
