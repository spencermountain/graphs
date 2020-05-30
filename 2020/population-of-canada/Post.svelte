<script>
  // import { Sankey, Node } from 'somehow-sankey'
  import { Sankey, Node } from '/Users/spencer/mountain/somehow-sankey'
  import { Head, Foot } from '../../components/'
  export let title = 'Population of Canada'
  //from Wikipedia by Metro area
  // https://en.wikipedia.org/wiki/Metropolitan_area
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head num="11" />
  <div class="m3">Population of Canada</div>
  <div class="m3">

    <Sankey height="800">
      <Node name="Canada" color="red" col={2} />

      <Node name="Toronto" to="Ontario" value="6" color="sky" col={0} />
      <Node name="Ottawa" to="Ontario" value="1" color="sky" col={0} />
      <Node name="Ontario" to="Canada" value="14" color="sky" col={1} />

      <Node name="Montreal" to="Quebec" value="4" color="mud" col={0} />
      <Node name="Quebec" to="Canada" value="8" color="mud" col={1} />

      <Node name="Vancouver" to="B.C." value="2.4" color="burn" col={0} />
      <Node name="B.C." to="Canada" value="5" color="burn" col={1} />

      <Node name="Calgary" to="Alberta" value="1.3" col={0} color="greygreen" />
      <Node name="Alberta" to="Canada" value="4" col={1} color="greygreen" />

      <Node name="Nova Scota" to="Canada" value="1" col={1} />
      <Node name="Manitoba" to="Canada" value="1" col={1} />
      <Node name="Saskatchewan" to="Canada" value="1" col={1} />
      <Node name="rest" to="Canada" value={1} col={1} />

    </Sankey>

  </div>

  <Foot {title} />
</div>
