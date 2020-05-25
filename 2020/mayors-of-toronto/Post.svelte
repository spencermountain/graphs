<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'

  import {
    Timeline,
    Column,
    Line,
    colors,
    Ticks,
    Label,
    Now,
    WideLabel,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  import mayors from './data'
  let year = new Date().getFullYear()
  let start = 'Jan 1 1834'
  let end = 'Dec 31 2030'
  let height = 3500
  export let title = 'Mayors of Toronto'
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} num="06" />
  <div class="m3">
    <Timeline {start} {end} {height} {title}>
      <WideLabel date="July 1, 1867" color="lightgrey" label="Confederation" />
      <WideLabel date="Jan 1, 1998" color="lightgrey" label="amalgamation" />
      <WideLabel date="Jan 1, 1908" color="lightgrey" label="electricity" />
      <Ticks every="decade" />
      <Ticks every="year" size="8px" color="lightgrey" underline={false} />
      <!-- <Column width="2px">
        <Line width="3px" start="28 July 1914" end="11 November 1918" color="fire" label="" />
        <Line width="3px" start="1 September 1939" end="2 September 1945" color="fire" label="" />
      </Column> -->
      <Column width="40px">
        <Now color="blue" width="4px" label="now" />
        <Line
          space="15px"
          start="28 July 1914"
          end="11 November 1918"
          color="rose"
          opacity="0.5"
          size={'10px'}
          dotted={false}
          label="WW1" />
        <Line
          space="15px"
          start="September 13 1939"
          end="September 2 1945"
          color="rose"
          dotted={false}
          size={'10px'}
          opacity="0.5"
          label="WW2" />
      </Column>

      <Column width="250px">
        {#each mayors as mayor, i}
          <Line
            space="15px"
            width="4px"
            start={mayor.start}
            margin={3}
            size="14px"
            end={mayor.end}
            color={colors.combos.dupont[i % 6]}
            label={mayor.name} />
        {/each}
      </Column>

      <Column width="5px">

        <Line space="15px" opacity="0.5" start="March 30 1954" color="yellow" label="Line 1" />
      </Column>
      <Column width="5px">

        <Line space="15px" opacity="0.5" start="May 10, 1968" color="green" label="Line 2" />
      </Column>
      <Column width="5px">
        <Line
          start="July 1 1952"
          end="August 1956"
          opacity="0.5"
          label="401"
          color="grey"
          side="left"
          align="left" />
        <Line space="15px" opacity="0.5" start="March 22, 1985" color="sky" label="Line 3" />
      </Column>
      <Column width="5px">
        <Line
          start="July 1 1955"
          end="October 30, 1962"
          opacity="0.5"
          label="DVP"
          color="grey"
          side="left"
          align="left" />
        <Line space="15px" opacity="0.5" start="November 22, 2002" color="purple" label="Line 4" />
      </Column>
      <Column width="5px">
        <Line
          start="Jan 1 1955"
          end="August 1960"
          opacity="0.5"
          label="Gardiner"
          color="grey"
          side="left"
          align="left" />
        <Line space="15px" opacity="0.5" start="November 22, 2022" color="pink" label="Crosstown" />
      </Column>
      <Column width="55px">

        <Line
          space="15px"
          start="November 22, 2023"
          color="grey"
          opacity="0.5"
          label="Finch West" />
      </Column>
      <Column width="150px">

        <Line
          space="15px"
          start="1889"
          end="1899"
          color="rose"
          opacity="0.5"
          label="(Old) City Hall" />
        <Line
          space="15px"
          start="1927"
          end="1929"
          color="rose"
          opacity="0.5"
          label="Royal York Hotel" />
        <Line
          space="15px"
          start="May 30, 1931"
          end="November 12, 1931"
          color="rose"
          opacity="0.5"
          label="Maple Leaf Gardens" />

        <Line
          start="November 7 1961"
          end="September 13 1965"
          opacity="0.5"
          label="City Hall"
          color="rose"
          side="left"
          align="left" />
        <Line
          start="August 20 1973"
          end="August 20 1976"
          opacity="0.5"
          label="CN tower"
          color="rose"
          side="left"
          align="left" />
        <Line
          start="October 3, 1986"
          end="June 3 1989"
          opacity="0.5"
          label="Skydome"
          color="rose"
          side="left"
          align="left" />

      </Column>

      <Column width="30px">
        <Line
          start="October 3, 1957"
          end="February 28, 1964"
          label="Pearson #1"
          color="purple"
          opacity="0.7"
          side="left"
          align="left" />
        <Line
          start="1970"
          end="June 15, 1972"
          label="Terminal 2"
          color="purple"
          opacity="0.7"
          side="left"
          align="left" />
        <Line
          start="1989"
          end="February 21 1991"
          label="Terminal 3"
          color="purple"
          opacity="0.7"
          side="left"
          align="left" />
      </Column>
      <!-- population -->
      <!-- <Column width="200px">
          <Area data={population} width="120" color="slategrey" opacity="0.6" />
        </Column> -->
    </Timeline>
  </div>
  <Foot {title} />
</div>
