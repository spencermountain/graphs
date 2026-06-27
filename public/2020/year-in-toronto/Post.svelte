<script>
  import { Page } from '../../components/index.mjs'
  export let title = 'The Year in Toronto'
  // export let sub = ''

  import {
    Timeline,
    Ticks,
    Line,
    WideLabel,
    Now,
    Column,
    Label,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  let d = new Date()
  let year = d.getFullYear()
  let start = 'Dec 20 ' + (year - 1)
  let end = 'Dec 31 ' + year
  let height = 900
</script>

<Page {title} num={'03'}>
  <div class="m3">
    <Timeline {start} {end} {height} {title}>
      <Column width="65px">
        <Ticks every="month" />
      </Column>
      <Now label="today" />
      <!-- hockey -->
      <Column width="60px">
        <Label start="Jan 1 {year}" end="April 6 {year}" color="navy" label="Leafs" />
        <Label start="October 3 {year}" end="Dec 31 {year}" color="navy" label="Leafs" />
      </Column>
      <!-- baseball -->
      <Column width="60px">
        <Label start="March 29 {year}" end="Oct 1 {year}" color="lightblue" label="Blue Jays" />
      </Column>
      <!-- basketball -->
      <Column width="80px">
        <Label start="Jan 1 {year}" end="April 10 {year}" color="red" label="Raptors" />
        <Label start="October 16 {year}" end="Dec 31 {year}" color="red" label="Raptors" />
      </Column>
      <!-- mls -->
      <Column width="60px">
        <Label start="March 3 {year}" end="Dec 1 {year}" color="tulip" label="TFC" />
      </Column>
      <Column width="80px">
        <Label
          start="April 20 {year}"
          end="Sept 10 {year}"
          label="Patios"
          color="slate"
          side="left"
          align="left"
          opacity="0.7"
        />
      </Column>

      <Column width="125px" title="">
        <Line
          start="June 14 {year}"
          duration="7 days"
          label="Pride"
          color="rose"
          side="left"
          align="left"
          opacity="0.7"
        />
        <Line
          start="July 14 {year}"
          duration="7 days"
          label="Fringe"
          color="rose"
          side="left"
          align="left"
          opacity="0.7"
        />
        <Line
          start="August 20 {year}"
          duration="7 days"
          label="CNE"
          color="rose"
          side="left"
          align="left"
          opacity="0.7"
        />
        <Line
          start="Sept 14 {year}"
          duration="7 days"
          label="TIFF"
          color="rose"
          side="left"
          align="left"
          opacity="0.7"
        />
        <Line
          start="Oct 14 {year}"
          duration="2 days"
          label="Nuit-blanche"
          color="orange"
          side="left"
          align="left"
          opacity="0.7"
        />
      </Column>

      <Column width="60px" label="">
        <Line start="Jan 1 {year}" end="Feb 10 {year}" color="lighter" label="Snow" />
        <Line start="Dec 10 {year}" end="Dec 31 {year}" color="lighter" label="Snow" />
        <!-- <Line
        
        start="Feb 11 {year}"
        end="May 4 {year}"
        color="sky"
        label="rain"
        opacity="0.4" /> -->
        <Line start="May 5 {year}" end="Oct 1 {year}" color="green" label="Leaves" />
        <Line start="Oct 5 {year}" end="Oct 25 {year}" color="beige" label="Fall" />
        <!-- <Line
        
        start="oct 2 {year}"
        end="dec 9 {year}"
        color="sky"
        label="rain"
        opacity="0.4" /> -->
      </Column>
      <Column width="60px">
        <Line start="Jan 1 {year}" end="April 12 {year}" color="blue" label="Coats" />
        <Line start="Nov 1 {year}" end="Dec 31 {year}" color="blue" label="Coats" />
        <Line start="May 24 {year}" end="Sept 1 {year}" color="purple" label="Shorts" />
      </Column>
    </Timeline>
  </div>
</Page>

<style>
  .m3 {
    margin: 3rem;
  }
</style>
