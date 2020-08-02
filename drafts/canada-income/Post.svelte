<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import { Round, Arc, Line, Label, Circle } from '/Users/spencer/mountain/somehow-circle/src'
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .row {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
  }
</style>

<div class="main">
  <Head num="18" />
  <div class="m3">Income by demographic in Canada, during Covid-19</div>

  <div class="m3 row" style="max-width:800px;">
    <Round rotate="0" margin="10">

      <Arc
        from={90}
        to={181}
        color="blue"
        width="12"
        label={'child benefit'}
        radius="10"
        opacity="0.6" />
      <Arc from={181} to={270} color="red" width="3" label={'CERB'} radius="24" />

      <Arc from={18} to={90} color="purple" width="11" label={'CPP/OAS'} radius="14" />

      <!-- poverty line -->
      <Label text="poverty line" radius="16" color="green" />
      <Circle
        radius="20"
        color="green"
        fill="green"
        width="0.5"
        dotted={true}
        label="poverty-line" />

    </Round>
  </div>

  <Foot />
</div>
