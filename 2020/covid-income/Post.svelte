<script>
  import { Page } from '../../components/index.mjs'
  import { Round, Arc, Label, Circle } from '/Users/spencer/mountain/somehow-circle/src'
  let title = `Income by demographic in Canada, during Covid-19`
</script>

<Page {title} grow={true}>
  <Round rotate="0" margin="10">
    <!-- child benefit -->
    <Arc from={90} to={181} color="blue" width="8" radius="5" opacity="0.6" />
    <Label text="Child Benefit" radius="14" align="middle" at="150" color="blue" size="1.5" />
    <!-- CERB -->
    <Arc from={181} to={270} color="red" width="18" label={'CERB'} radius="5" />
    <Label text="CERB" radius="28" align="middle" at="220" color="red" size="2.5" />
    <!-- CPP -->
    <Arc from={18} to={90} color="purple" width="23" radius="2" />
    <Label text="CPP/" radius="36" align="left" at="50" color="purple" size="2" />
    <Label text="OAS" radius="36" align="left" at="42.5" color="purple" size="2" />
    <!-- poverty line -->
    <Label text="poverty line" radius="22" align="right" at="5" color="green" />
    <Arc from="180" to="450" radius="20" color="green" fill="green" width="0.5" />
    <!-- mean salary -->
    <Circle radius="50" color="pink" width="0.2" />
    <Label text="mean" radius="51.5" align="right" at="142" color="pink" />
    <Label text="salary" radius="51.5" align="right" at="145" color="pink" />
    <Label text="50k" radius="51.5" align="right" at="148" size="1.6" color="pink" />
    <!-- r-axis -->
    <Circle radius="0" color="lighter" width="0.1" dotted={true} />
    <Circle radius="10" color="lighter" width="0.1" dotted={true} />
    <Circle radius="20" color="lighter" width="0.1" dotted={true} />
    <Circle radius="30" color="lighter" width="0.1" dotted={true} />
    <Label text="30k" radius="35.5" at="135" color="lighter" />
    <Circle radius="40" color="lighter" width="0.1" dotted={true} />
    <Label text="40k" radius="45.5" at="135" color="lighter" />
    <!-- <Circle radius="50" color="lighter" width="0.1" dotted={true} /> -->
    <!-- <Label text="50k" radius="54" at="135" color="lighter" /> -->
    <Circle radius="60" color="lighter" width="0.1" dotted={true} />
    <Label text="60k" radius="65.5" at="135" color="lighter" />
    <Circle radius="70" color="lighter" width="0.1" dotted={true} />
    <Label text="70k" radius="75.5" at="135" color="lighter" />
    <Circle radius="80" color="lighter" width="0.1" dotted={true} />
    <Label text="80k" radius="85.5" at="135" color="lighter" />
    <!-- <Circle radius="90" color="lighter" width="0.1" dotted={true} /> -->
    <!-- <Label text="90k" radius="95.5" at="135" color="lighter" /> -->
    <!-- <Circle radius="100" color="lighter" width="0.1" dotted={true} /> -->
    <!-- <Label text="100k" radius="105.5" at="135" color="lighter" /> -->

    <!-- salaries -->
    <Arc from={270} to={280} color="sky" width="1" radius="20" opacity="0.6" />
    <Arc from={280} to={290} color="sky" width="1" radius="30" opacity="0.6" />
    <Arc from={290} to={300} color="sky" width="1" radius="40" opacity="0.6" />
    <Arc from={300} to={310} color="sky" width="1" radius="50" opacity="0.6" />
    <Arc from={310} to={320} color="sky" width="1" radius="50" opacity="0.6" />
    <Arc from={320} to={330} color="sky" width="1" radius="50" opacity="0.6" />
    <Arc from={330} to={340} color="sky" width="1" radius="50" opacity="0.6" />
    <Arc from={340} to={350} color="sky" width="1" radius="60" opacity="0.6" />
    <Arc from={350} to={360} color="sky" width="1" radius="70" opacity="0.6" />
    <Arc from={360} to={370} color="sky" width="1" radius="80" opacity="0.6" />
  </Round>
</Page>

<style>
</style>
