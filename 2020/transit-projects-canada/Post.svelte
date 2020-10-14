<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
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
  export let title = 'Public transit by year, in Canada'
  export let sub = ''
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} num="16" />
  <div class="m3">
    <Timeline start="1940" end="today" height="700">
      <Axis />
      <Column label="" color="navy">
        <Text color="blue" label="Vancouver" date="1965" underline={true} />
        <Label start="1985" color="blue" label="expo" dodge="0px" />
        <Label start="August 17, 2009" color="sky" label="canada" dodge="30px" />
        <Label start="October 22, 2016" color="yellow" label="millenium" dodge="60px" />
      </Column>
      <Column label="" color="navy">
        <Text color="blue" label="Calgary" date="1965" underline={true} />
        <Label start="1981" color="red" label="cTrain" />
        <!-- <Label start="1981" color="blue" topLabel="blue" /> -->
      </Column>
      <Column label="" color="navy">
        <Text color="blue" label="Edmonton" date="1965" underline={true} />
        <Label start="1978" color="fire" label="metro" />
        <Label start="2010" color="blue" label="capital" dodge="30px" />
      </Column>
      <Column label="">
        <Text color="blue" label="Toronto" date="1943" underline={true} />
        <Label start="1954" color="yellow" topLabel="yonge" />
        <Label start="1966" color="green" topLabel="bloor" dodge="30px" />
        <Label start="1985" color="sky" topLabel="scarborough" dodge="60px" />
        <Label start="1985" color="purple" label="sheppard" dodge="90px" />
      </Column>
      <Column label="">
        <Text color="blue" label="Ottawa" date="1965" underline={true} />
        <Label start="October 15, 2001" color="green" label="trillium" />
        <Label start="September 14, 2019" color="red" label="confederation" dodge="30px" />
      </Column>
      <Column label="">
        <Text color="blue" label="Montreal" date="1960" underline={true} />
        <Label start="October 1966" label="" color="green" />
        <Label start="October 14, 1966" label="" color="orange" dodge="30px" />
        <Label start="April 28, 1967" label="" color="yellow" dodge="60px" />
        <Label start="16 June 1986" label="" color="blue" dodge="90px" />
      </Column>

    </Timeline>
  </div>
  <Foot {title} />
</div>
