<script>
  import { Page } from '../../components/index.mjs'
  import playoffs from './data/playoffs.json'
  import teams from './data/teams.json'
  export let title = 'NHL playoff appearances by time'
  export let sub = ''
  let team = 'Toronto'

  import {
    Timeline,
    Column,
    Ticks,
    Bar,
  } from '/Users/spencer/mountain/somehow-timeline/src/index.mjs'

  let years = []
  for (let i = 1968; i <= 2019; i += 1) {
    years.push(i)
  }
  let start = 'jan 1 1965'
  let end = 'jan 1 2020'
  let height = 900
</script>

<Page {title} {sub}>
  <div class="row" style="width:600px;">
    <select class="ml4" bind:value={team}>
      {#each teams as t}
        <option value={t}>{t}</option>
      {/each}
    </select>
  </div>
  <div class="all">
    <Timeline {start} {end} {height}>
      <Column width="25px">
        <Ticks every="decade" />
      </Column>
      <Column width="25px">
        <Ticks every="year" size="8px" color="lightgrey" underline={false} />
      </Column>
      <Column width="375px">
        <div class="labels">
          <div class="line">
            1st
            <br />
            round
          </div>
          <div class="line" style="left:75px;">
            2nd
            <br />
            round
          </div>
          <div class="line" style="left:150px;">semi-final</div>
          <div class="line" style="left:225px;">final</div>
          <div class="line" style="left:300px; border-right:none;">winner</div>
        </div>
        {#each years as year}
          <div class="row">
            {#each Array(playoffs[year][team] || 0) as round, i}
              <Bar
                start={'april 1 ' + year}
                color={i === 4 ? 'orange' : 'blue'}
                opacity="0.5"
                height="5px"
                width="70px"
                left={i * 75 + 'px'}
              />
            {/each}
          </div>
        {/each}
      </Column>
    </Timeline>
  </div>
</Page>

<style>
  .all {
    margin: 3rem;
    position: relative;
  }
  .ml4 {
    margin-left: 4rem;
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
  .line {
    position: absolute;
    border-right: 1px dotted grey;
    min-height: 100%;
    width: 75px;
    top: 0px;
    color: grey;
    font-size: 10px;
    line-height: 100%;
  }
  .labels {
    text-align: center;
  }
</style>
