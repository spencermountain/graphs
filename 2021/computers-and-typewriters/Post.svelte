<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import {
    Timeline,
    Axis,
    Line,
    Column,
    Ticks,
    Label,
    Text,
    Horizontal,
    Region,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'Typewriter and Computer timeline'
  export let sub = ''
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .row {
    flex: 1;
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
  }
</style>

<div>
  <Head {title} {sub} num={25} />
  <div class="row">
    <div class="m3" style="width:600px;">
      <Timeline start="1900" end="Dec 30 1970" height="400">

        <Column>
          <Text date="1900" color="sky" label="Typewriters" underline={true} />
          <Label
            start="1910"
            end="1917"
            color="sky"
            label="Standard"
            dodge="40px"
            width="8px"
            opacity="0.4" />
          <Label
            start="1917"
            end="1929"
            color="blue"
            label="Portable"
            dodge="40px"
            width="8px"
            opacity="0.4" />
          <Label
            start="1929"
            end="1933"
            color="sky"
            label="Varityper"
            dodge="40px"
            width="8px"
            opacity="0.4" />
          <Label
            start="1933"
            end="1939"
            color="orange"
            label="Electromatic"
            dodge="40px"
            width="8px"
            opacity="0.4" />
          <Label
            start="1939"
            end="1960"
            color="#cc7c66"
            label="Automatic"
            dodge="40px"
            width="8px"
            opacity="0.4" />
          <Label
            start="1960"
            end="1964"
            color="fire"
            label="Selectric"
            dodge="40px"
            width="8px"
            opacity="0.4" />
          <Label
            start="1964"
            end="1968"
            color="red"
            label="MG/ST"
            dodge="40px"
            width="8px"
            opacity="0.4" />

        </Column>

        <Column>
          <Ticks every="decade" />
        </Column>

        <!-- computers -->
        <Column>
          <Text date="1900" color="sky" label="Computers" underline={true} />
          <Label
            start="1936"
            end="1942"
            label="Z1"
            size="11px"
            dodge="40px"
            color="pink"
            width="8px"
            hide={false} />
          <Label
            start="1943"
            end="1947"
            label="Eniac"
            size="11px"
            dodge="40px"
            color="lightblue"
            width="8px"
            hide={false} />
          <Label
            start="1947"
            end="1951"
            label="IBM 701"
            size="11px"
            dodge="40px"
            color="pink"
            width="8px"
            hide={false} />
          <Label
            start="1951"
            end="1955"
            label="Z4"
            size="11px"
            dodge="40px"
            color="lightblue"
            width="8px"
            hide={false} />
          <Label
            start="1956"
            end="1962"
            label="RAMAC"
            size="11px"
            dodge="40px"
            color="pink"
            width="8px"
            hide={false} />
          <Label
            start="1962"
            end="1968"
            label="Atlas"
            size="11px"
            dodge="40px"
            color="lightblue"
            width="8px"
            hide={false} />
          <Label
            start="April 4, 1975"
            end="today"
            color="blue"
            topLabel="Microsoft"
            dodge="40px"
            size="9px"
            opacity="0.4" />
          <!-- <Label
            start="September 4, 1998"
            end="today"
            color="orange"
            topLabel="Google"
            size="9px"
            dodge="80px"
            opacity="0.4" /> -->
          <Label
            start="April 1, 1976"
            end="today"
            color="silver"
            topLabel="Apple"
            dodge="0px"
            size="9px"
            opacity="0.4" />
        </Column>

        <!-- horizontal-span -->
        <Horizontal date="December 1968" color="red" align="right" width="50%" left="15%" />
        <Region start="1936" end="December 1967" color="sky" width="6.5%" left="36.5%" />
      </Timeline>

    </div>
  </div>
  <!-- <Foot {title} /> -->
</div>
