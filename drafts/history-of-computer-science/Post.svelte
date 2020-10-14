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
    Horizontal,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'History of computer programming'
  export let sub = ''
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} />
  <div class="m3">
    <Timeline start="1940" end="Dec 30 2020" height="700">
      <Axis />
      <Horizontal date="1950" label="Information Theory" color="rose" width="50%" left="25%" />
      <Horizontal
        date="December 1968"
        label="Engelbart demo"
        color="pink"
        align="right"
        width="50%"
        left="15%" />
      <Column>
        <Label start="1945" end="1986" color="sky" topLabel="cold war" width="8px" />
        <Point start=" 10 Nov 1977" label="Alto" color="rose" font="12px" />
      </Column>
      <!-- languages -->
      <Column>
        <Label start="1972" end="today" color="orange" topLabel="c" width="8px" />
        <Label start="1990" end="today" color="purple" topLabel="python" width="8px" dodge="20px" />
        <Label
          start="December 4 1995"
          end="today"
          color="yellow"
          topLabel="js"
          width="8px"
          dodge="40px" />
      </Column>
      <!-- companies -->
      <Column>
        <Label start="April 4, 1975" end="today" color="blue" topLabel="Microsoft" />
        <Point start="August 12, 1981" label="DOS" color="blue" font="12px" size="10" />
        <!-- <Point start="December 15, 1999" label="2k" color="blue" font="12px" /> -->
        <Point start="October 25, 2001" label="xp" color="blue" font="12px" size="10" />
        <Point start="November 30, 2006" label="vista" color="blue" font="12px" size="10" />
      </Column>
      <Column>
        <Label start="April 1, 1976" end="today" color="silver" topLabel="Apple" />
        <Point start="January 24, 1984" label="Mac" color="silver" font="11px" size="10" />
        <Point start="October 23, 2001" label="iPod" color="silver" font="11px" size="10" />
        <Point start="January 2007" label="iPhone" color="silver" font="11px" size="10" />
      </Column>
      <Column>
        <Label start="September 4, 1998" end="today" color="orange" topLabel="Google" />
      </Column>
      <Column>
        <Label start="February 4, 2004" end="today" color="navy" topLabel="Facebook" />
      </Column>
    </Timeline>

  </div>
  <Foot {title} />
</div>
