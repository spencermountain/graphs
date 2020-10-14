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
  export let title = 'Timline of computer programming'
  export let sub = ''
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} num={20} />
  <div class="m3">
    <Timeline start="1940" end="Dec 30 2020" height="700">
      <Axis />
      <Horizontal
        date="1940"
        label="theory of communication"
        align="right"
        color="rose"
        width="50%"
        left="25%" />
      <Horizontal
        date="December 1968"
        label="Engelbart demo"
        color="pink"
        align="right"
        width="50%"
        left="15%" />

      <!-- <Horizontal
        date="June 2001"
        color="fire"
        label="bubble"
        left="100px"
        width="80px"
        hide={true} /> -->

      <Column>
        <Label
          start="1939"
          end="1945"
          color="fire"
          topLabel="ww2"
          width="8px"
          dotted={true}
          hide={true} />
        <Label
          start="1945"
          end="1986"
          color="sky"
          label="cold war"
          width="8px"
          dotted={true}
          hide={true} />
        <Label
          start="February 7, 1958"
          end="1970"
          color="suede"
          label="DARPA"
          width="8px"
          size="11px"
          dodge="20px"
          hide={false} />

        <Label
          start="January 1991"
          end="today"
          label="www"
          size="11px"
          color="lightblue"
          width="8px"
          hide={false} />

        <Point start="10 Nov 1977" label="Alto" color="rose" font="12px" size="10" hide={true} />
        <Point
          start="March 10, 1997"
          label="Palm Pilot"
          color="green"
          font="12px"
          size="10"
          hide={true} />
        <Point
          start="September 2013"
          label="Blackberry"
          color="purple"
          font="12px"
          size="10"
          hide={true} />
        <Point start="1940" label="Enigma" color="blue" font="12px" size="10" hide={true} />
        <Point
          start="December 10, 1945"
          label="Eniac"
          color="sky"
          font="12px"
          size="10"
          hide={true} />
        <Point
          date="January 15, 2001"
          color="grey"
          label="wikipedia"
          font="8px"
          width="10%"
          hide={true} />

      </Column>

      <!-- languages -->
      <Column width="200px">
        <Label start="1972" end="today" color="orange" topLabel="C" width="8px" />
        <Label start="1990" end="today" color="purple" topLabel="Python" width="8px" dodge="20px" />
        <Label
          start="January 1996"
          end="today"
          color="suede"
          topLabel="Java"
          width="8px"
          dodge="40px" />
        <Label
          start="December 4 1995"
          end="today"
          color="yellow"
          topLabel="Js"
          width="8px"
          dodge="-20px" />
      </Column>

      <!-- companies -->
      <Column width="100px">
        <Label start="April 4, 1975" end="today" color="blue" topLabel="Microsoft" />
        <Point start="August 12, 1981" label="DOS" color="blue" font="12px" size="10" />
        <!-- <Point start="December 15, 1999" label="2k" color="blue" font="12px" /> -->
        <Point start="October 25, 2001" label="xp" color="blue" font="12px" size="10" />
        <Point start="November 30, 2006" label="vista" color="blue" font="12px" size="10" />
      </Column>
      <Column width="100px">
        <Label start="April 1, 1976" end="today" color="silver" topLabel="Apple" />
        <Point start="January 24, 1984" label="Mac" color="silver" font="11px" size="10" />
        <Point start="October 23, 2001" label="iPod" color="silver" font="11px" size="10" />
        <Point start="January 2007" label="iPhone" color="silver" font="11px" size="10" />
      </Column>
      <Column width="100px">
        <Label start="September 4, 1998" end="today" color="orange" topLabel="Google" />
        <Point start="April 1, 2004" label="gmail" color="orange" font="11px" size="10" />
        <Point start="April 2005" label="maps" color="orange" font="11px" size="10" />
      </Column>
      <Column width="100px">
        <Label start="February 4, 2004" end="today" color="navy" topLabel="Facebook" />
        <Point start="September 26, 2018" label="oculus" color="navy" font="11px" size="10" />
      </Column>

    </Timeline>

  </div>
  <Foot {title} />
</div>
