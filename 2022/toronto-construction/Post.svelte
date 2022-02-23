<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import {
    Timeline,
    Column,
    Line,
    Ticks,
    Label,
    WideLabel,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  let year = new Date().getFullYear()
  let start = 'Jan 1 1910'
  let end = 'Dec 31 2022'
  let height = 1500
  export let title = 'Toronto Construction '
</script>

<div>
  <Head {title} num="01" />
  <div class="m3">
    <Timeline {start} {end} {height} {title}>
      <Line
        space="15px"
        start="28 July 1914"
        end="11 November 1918"
        color="rose"
        opacity="0.4"
        size={'10px'}
        dotted={false}
        label="WW1"
      />
      <Line
        space="15px"
        start="September 13 1939"
        end="September 2 1945"
        color="rose"
        dotted={true}
        size={'10px'}
        opacity="0.4"
        label="WW2"
      />
      <Column width="30px">
        <Ticks every="decade" />
      </Column>
      <Column width="50px" />

      <Column>
        <!-- <Label
          space="15px"
          start="1889"
          end="1899"
          color="rose"
          opacity="0.5"
          label="(Old) City Hall"
        /> -->
        <Label
          space="15px"
          start="1927"
          end="1929"
          color="blue"
          opacity="0.5"
          label="Royal York Hotel"
        />
        <Label
          space="15px"
          start="May 30, 1931"
          end="November 12, 1931"
          color="blue"
          opacity="0.5"
          label="Maple Leaf Gardens"
        />

        <Label
          start="November 7 1961"
          end="September 13 1965"
          opacity="0.5"
          label="City Hall"
          color="blue"
          side="left"
          align="left"
        />
        <Label
          start="August 20 1973"
          end="August 20 1976"
          opacity="0.5"
          label="CN tower"
          color="blue"
          side="left"
          align="left"
        />
        <Label
          start="October 3, 1986"
          end="June 3 1989"
          opacity="0.5"
          label="Skydome"
          color="blue"
          side="left"
          align="left"
        />
        <Label
          start="March 29, 2006"
          end="April 28, 2007"
          opacity="0.5"
          label="BMO"
          color="blue"
          side="left"
          align="left"
        />
      </Column>

      <Column width="100px">
        <Label
          start="October 3, 1945"
          end="March 30, 1954"
          label="Line 1"
          color="yellow"
          opacity="0.7"
          side="left"
          align="left"
        />
        <Label
          start="July 28, 2010"
          end="jan 1 2023"
          label="Crosstown"
          color="orange"
          opacity="0.7"
          side="left"
          align="left"
        />
      </Column>
      <Column width="100px">
        <Label
          start="November 1 1959"
          end="February 26, 1966"
          label="Line 2"
          color="#76a15a"
          opacity="0.7"
          side="left"
          align="left"
        />
        <Label
          start="jan 1 1994"
          end="November 22, 2002"
          label="Sheppard"
          color="#978BA3"
          opacity="0.7"
          side="left"
          align="left"
        />
      </Column>
      <Column width="100px">
        <Label
          start="jan 1 1955"
          end="jan 1 1963"
          label="Gardiner"
          color="grey"
          opacity="0.7"
          side="left"
          align="left"
        />
      </Column>
      <Column>
        <Label
          start="sept 1 1955"
          end="March 1, 1967"
          label="DVP"
          color="grey"
          opacity="0.7"
          side="left"
          align="left"
        />
      </Column>

      <Column>
        <Label
          start="October 3, 1957"
          end="February 28, 1964"
          label="Pearson 1"
          color="purple"
          opacity="0.7"
          side="left"
          align="left"
        />
        <Label
          start="1970"
          end="June 15, 1972"
          label="Terminal 2"
          color="purple"
          opacity="0.7"
          side="left"
          align="left"
        />
        <Label
          start="1989"
          end="February 21 1991"
          label="Terminal 3"
          color="purple"
          opacity="0.7"
          side="left"
          align="left"
        />
      </Column>
    </Timeline>
  </div>
  <Foot {title} />
</div>

<style>
  .m3 {
    margin: 3rem;
  }
</style>
