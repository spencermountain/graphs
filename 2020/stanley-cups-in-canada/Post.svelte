<script>
  import { Page } from '../../components/index.mjs'
  import data from './data'
  import { Timeline, Axis, Column, Dash, Text } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'Stanley Cup wins in Canada'
  export let sub = ''
  let byTeam = {}
  data.forEach((row) => {
    if (row.team) {
      byTeam[row.team] = byTeam[row.team] || []
      byTeam[row.team].push(row.year)
    }
  })
  console.log(byTeam)
</script>

<Page {title} {sub} grow={true} max={1200} min={420}>
  <div class="m3">
    <Timeline start="1960" end="today" height="700">
      <Axis />
      <Column>
        <div class="city">Vancouver</div>
        <!-- <Text
          color="sky"
          size="13px"
          align="right"
          label="Vancouver"
          date="1960"
          underline={true}
        /> -->
        <!-- {#each byTeam.vancouver as year}
          <Dash date={'jan 1 ' + year} color="sky" height="10px" />
        {/each} -->
      </Column>
      <Column>
        <!-- <Text color="#d48481" size="13px" label="Calgary" date="1960" underline={true} /> -->
        <div class="city" style="color:#d48481;">Calgary</div>
        {#each byTeam.calgary as year}
          <Dash date={'jan 1 ' + year} color="#d48481" height="10px" title={year} />
        {/each}
      </Column>
      <Column>
        <!-- <Text color="silver" size="13px" label="Edmonton" date="1960" underline={true} /> -->
        <div class="city">Edmonton</div>
        {#each byTeam.edmonton as year}
          <Dash date={'jan 1 ' + year} color="silver" height="10px" title={year} />
        {/each}
      </Column>
      <Column>
        <!-- <Text color="grey" size="13px" label="Winnipeg" date="1960" underline={true} /> -->
        <div class="city">Winnipeg</div>
        <!-- {#each byTeam.winnipeg as year}
          <Dash date={'jan 1 ' + year} color="grey" height="10px" />
        {/each} -->
      </Column>
      <Column>
        <!-- <Text color="blue" size="13px" label="Toronto" date="1960" underline={true} /> -->
        <div class="city" style="color:steelblue;">Toronto</div>
        {#each byTeam.toronto as year}
          <Dash date={'jan 1 ' + year} color="blue" height="10px" title={year} />
        {/each}
      </Column>
      <Column>
        <!-- <Text color="orange" size="13px" label="Ottawa" date="1960" underline={true} /> -->
        <div class="city">Ottawa</div>
        <!-- {#each byTeam.ottawa as year}
          <Dash date={'jan 1 ' + year} color="orange" height="10px" />
        {/each} -->
      </Column>
      <Column>
        <!-- <Text color="red" size="13px" label="Montreal" date="1960" underline={true} /> -->
        <div class="city" style="color:#cc7066">Montreal</div>
        {#each byTeam.montreal as year}
          <Dash date={'jan 1 ' + year} color="red" height="10px" title={year} />
        {/each}
      </Column>
      <Column>
        <!-- <Text color="#7dd1d1" size="13px" label="Quebec" date="1960" underline={true} /> -->
        <div class="city">Quebec</div>
        <!-- {#each byTeam.ottawa as year}
          <Dash date={'jan 1 ' + year} color="orange" height="10px" />
        {/each} -->
      </Column>
    </Timeline>
  </div>
</Page>

<style>
  .m3 {
    margin: 3rem;
    text-align: center;
  }
  .city {
    font-size: 13px;
    color: #a3a5a5;
    /* border-bottom: 1px solid lightsteelblue; */
  }
  @media only screen and (max-width: 900px) {
    .city {
      /* font-size: 11px; */
      transform: rotate(290deg) translate(0px, 30px);
      width: 0px;
    }
    .m3 {
      margin: 1rem;
      margin-top: 3rem;
    }
  }
</style>
