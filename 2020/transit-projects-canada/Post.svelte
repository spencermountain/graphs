<script>
  import { Page } from '../../components/index.mjs'
  import { Timeline, Axis, Column, Label, Text } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'Public transit development in Canada'
  export let sub = ''
</script>

<Page {title} {sub}>
  <div class="m3">
    <Timeline start="1940" end="today" height="700">
      <Axis />
      <Column width="120px; " label="" color="navy">
        <Text color="blue" label="Vancouver" date="1965" underline={true} />
        <Label start="1985" color="blue" topLabel="expo" dodge="0px" />
        <Label start="August 17, 2009" color="sky" topLabel="canada" dodge="30px" />
        <Label start="October 22, 2016" color="yellow" topLabel="millenium" dodge="60px" />
      </Column>
      <Column width="100px;" label="" color="navy">
        <Text color="blue" label="Calgary" date="1965" underline={true} />
        <Label start="1981" color="red" topLabel="cTrain" />
        <!-- <Label start="1981" color="blue" topLabel="blue" /> -->
      </Column>
      <Column width="100px;" label="" color="navy">
        <Text color="blue" label="Edmonton" date="1965" underline={true} />
        <Label start="1978" color="fire" topLabel="metro" />
        <Label start="2010" color="blue" topLabel="capital" dodge="30px" />
      </Column>
      <Column width="200px;" label="">
        <Text color="blue" label="Toronto" date="1943" underline={true} />
        <Label start="1954" color="yellow" topLabel="yonge" />
        <Label start="1966" color="green" topLabel="bloor" dodge="30px" />
        <Label start="1985" color="sky" topLabel="scarborough" dodge="60px" />
        <Label start="1985" color="purple" label="sheppard" dodge="90px" />
      </Column>
      <Column width="120px;" label="">
        <Text color="blue" label="Ottawa" date="1965" underline={true} />
        <Label start="October 15, 2001" color="green" topLabel="trillium" />
        <Label start="September 14, 2019" color="red" label="confederation" dodge="30px" />
      </Column>
      <Column width="100px;" label="">
        <Text color="blue" label="Montreal" date="1960" underline={true} />
        <Label start="October 1966" topLabel="Green" color="green" />
        <Label start="October 14, 1966" topLabel="Orange" color="orange" dodge="30px" />
        <Label start="April 28, 1967" topLabel="Yellow" color="yellow" dodge="60px" />
        <Label start="16 June 1986" topLabel="Blue" color="blue" dodge="90px" />
      </Column>
    </Timeline>
  </div>
</Page>

<style>
  .m3 {
    margin: 3rem;
  }
</style>
