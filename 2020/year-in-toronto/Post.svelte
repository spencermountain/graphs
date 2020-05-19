<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  export let title = 'Year in Toronto'
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
  let start = 'Jan 1 ' + year
  let end = 'Dec 31 ' + year
  let height = 900
</script>

<style>

</style>

<Timeline {start} {end} {height} {title}>
  <Ticks every="month" />
  <Line />
  <Now label="today" />
  <!-- basketball -->
  <Column width="45px">
    <Line space="15px" end="April 10 {year}" color="red" label="Raptors" />
    <Line space="15px" start="October 16 {year}" end="Dec 31 {year}" color="red" label="" />
  </Column>
  <!-- hockey -->
  <Column width="45px">
    <Line space="15px" end="April 6 {year}" color="navy" label="Leafs" />
    <Line space="15px" start="October 3 {year}" end="Dec 31 {year}" color="navy" label="(Leafs)" />
  </Column>
  <!-- mls -->
  <Column width="20px">
    <Line space="15px" start="March 3 {year}" end="Dec 1 {year}" color="tulip" label="TFC" />
  </Column>
  <!-- baseball -->
  <Column width="80px">
    <Line
      space="15px"
      start="March 29 {year}"
      end="Oct 1 {year}"
      color="lightblue"
      label="Blue Jays" />
  </Column>

  <Column width="185px">
    <Label
      value="April 20 {year}"
      label="Patios"
      color="green"
      side="left"
      align="left"
      opacity="0.7" />
    <Label
      value="June 14 {year}"
      label="Pride"
      color="rose"
      side="left"
      align="left"
      opacity="0.7" />
    <Label
      value="July 14 {year}"
      label="Fringe"
      color="rose"
      side="left"
      align="left"
      opacity="0.7" />
    <Label
      value="August 20 {year}"
      label="CNE"
      color="rose"
      side="left"
      align="left"
      opacity="0.7" />
    <Label
      value="Sept 14 {year}"
      label="TIFF"
      color="rose"
      side="left"
      align="left"
      opacity="0.7" />
    <Label
      value="Oct 14 {year}"
      label="Nuit-blanche"
      color="orange"
      side="left"
      align="left"
      opacity="0.7" />
  </Column>

  <Column width="40px">
    <Line space="15px" start="Jan 1 {year}" end="Feb 10 {year}" color="lighter" label="snow" />
    <Line space="15px" start="Dec 10 {year}" end="Dec 31 {year}" color="lighter" label="snow" />
    <Line
      space="15px"
      start="Feb 11 {year}"
      end="May 4 {year}"
      color="sky"
      label="rain"
      opacity="0.4" />
    <Line space="15px" start="May 5 {year}" end="Oct 1 {year}" color="green" label="Leaves" />
    <Line
      space="15px"
      start="oct 2 {year}"
      end="dec 9 {year}"
      color="sky"
      label="rain"
      opacity="0.4" />
  </Column>
  <Column width="60px">
    <Line space="15px" start="Jan 1 {year}" end="April 12 {year}" color="blue" label="coats" />
    <Line space="15px" start="Nov 1 {year}" end="Dec 31 {year}" color="blue" label="coats" />
    <Line space="15px" start="May 24 {year}" end="Sept 1 {year}" color="purple" label="shorts" />
  </Column>
</Timeline>
