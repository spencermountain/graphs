<script>
  import { Page } from '../../components/index.mjs'
  import { Timeline, Column, Ticks, Dash } from '/Users/spencer/mountain/somehow-timeline/src'
  let start = 'Jan 1 1956'
  let end = 'Dec 31 2021'
  let height = 3500
  export let title = 'Rocket Launches'

  import atlas from './data/atlas.json'
  import saturn5 from './data/saturn5.json'
  import china from './data/china.json'
  import japan from './data/japan.json'
  import shuttle from './data/shuttle.json'
  import spacex from './data/spacex.json'
  import india from './data/india.json'
  import proton from './data/proton.json'
  import zenit from './data/zenit.json'
  import rokot from './data/rokot.json'
  import soyuz from './data/soyuz.json'
  console.log(soyuz.length)
</script>

<Page {title} num="07">
  <div class="m3">
    <Timeline {start} {end} {height} {title}>
      <Column width="15px">
        <Ticks every="decade" />
      </Column>
      <Column width="15px">
        <Ticks every="year" size="8px" color="lightgrey" underline={false} />
      </Column>

      <Column width="40px" label="Saturn 5">
        {#each saturn5 as rocket}
          <Dash start={rocket.date} color="blue" opacity="0.5" />
        {/each}
      </Column>

      <Column width="40px" label="Atlas">
        {#each atlas as rocket}
          <Dash start={rocket.date} color="sea" opacity="0.5" />
        {/each}
      </Column>

      <Column width="40px" label="Shuttle">
        {#each shuttle as rocket}
          <Dash start={rocket.date} color="pink" opacity="0.7" />
        {/each}
      </Column>

      <Column width="40px" label="China">
        {#each china as rocket}
          <Dash start={rocket.date} color="orange" opacity="0.5" />
        {/each}
      </Column>

      <Column width="40px" label="Japan">
        {#each japan as rocket}
          <Dash start={rocket.date} color="yellow" opacity="0.5" />
        {/each}
      </Column>

      <Column width="40px" label="SpaceX">
        {#each spacex as rocket}
          <Dash start={rocket.date} color="sea" opacity="0.5" />
        {/each}
      </Column>

      <Column width="40px" label="India">
        {#each india as rocket}
          <Dash start={rocket.date} color="suede" opacity="0.5" />
        {/each}
      </Column>

      <Column width="40px" label="Proton">
        {#each proton as rocket}
          <Dash start={rocket.date} color="red" opacity="0.5" />
        {/each}
      </Column>

      <Column width="40px" label="Zenit" color="red">
        {#each zenit as rocket}
          <Dash start={rocket.date} color="red" opacity="0.5" />
        {/each}
      </Column>

      <Column width="40px" label="Rokot" color="red">
        {#each rokot as rocket}
          <Dash start={rocket.date} color="red" opacity="0.5" />
        {/each}
      </Column>

      <Column width="40px" label="Soyuz" color="red">
        {#each soyuz as rocket}
          <Dash start={rocket.date} color="red" opacity="0.5" />
        {/each}
      </Column>
    </Timeline>
  </div>
</Page>

<style>
  .m3 {
    margin: 2rem;
  }
</style>
