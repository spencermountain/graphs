<script>
  import { Sankey, Path } from 'somehow-sankey'
  import { Head, Foot } from '../../components/'
  export let title = '2019 Budget of the Toronto Maple Leafs'
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} num="10" />
  <div class="m3">2019 Budget of the Toronto Maple Leafs</div>
  <div class="m3">
    <Sankey>
      <Path source="NHL" target="Leafs" value="8" order={1} />
      <Path source="Tickets" target="Leafs" value="50" />
      <Path source="In-Arena" target="Leafs" value="20" />
      <Path source="LocalTV" target="Leafs" value="5" />
      <Path source="Leafs" target="Player Salary" value="75" />
      <Path source="Leafs" target="Coach" value="6" />
    </Sankey>
  </div>

  <Foot {title} />
</div>
