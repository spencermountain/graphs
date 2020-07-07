<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import { Sankey, Node, Col } from '/Users/spencer/mountain/somehow-sankey/src'
  let fmt = num => {
    num = Number(num) * 1000000
    if (num >= 1000000000) {
      num = Math.round(num / 100000000) * 100000000
      num = Math.round(num)
      return String(num / 1000000000) + 'b'
    }
    if (num >= 1000000) {
      num = Math.round(num / 100000) * 100000
      num = Math.round(num)
      return String(num / 1000000) + 'm'
    }
    if (num > 1000) {
      num = Math.round(num / 10000) * 10000
      return String(num / 1000) + 'k'
    }
    return num
  }
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head num="14" />
  <div class="m3">
    <b>Toronto City Budget</b>
    <br />
    in 2020
  </div>

  <Sankey height="800" {fmt}>
    <Col>
      <Node name="Property Taxes" to="Toronto" value="4400" color="sea" />
      <Node name="Province/Fed" to="Toronto" value="2500" color="red" />
      <Node name="TTC Fares" to="Toronto" value="1300" color="sky" />
      <Node name="Fees" to="Toronto" value="900" color="sky" />
      <Node name="Land-transfer" to="Toronto" value="800" color="sky" />
      <Node name="Misc" to="Toronto" value="600" color="sea" />
      <Node name="Investment" to="Toronto" value="300" color="sea" />
      <Node name="Reserves" to="Toronto" value="500" color="sea" />
      <Node name="Transfers" to="Toronto" value="300" color="sea" />

    </Col>
    <Col>
      <Node
        name="Toronto"
        value="11600"
        color="blue"
        full="87.2"
        append="* 1.5bn covid short-fall" />
    </Col>
    <Col>
      <Node name="Social Programs" from="Toronto" value="3300" color="#6E9588" />
      <Node name="TTC" from="Toronto" value="2100" color="red" />
      <Node name="Police" from="Toronto" value="1200" color="#CDADD9" />
      <Node name="Fire" from="Toronto" value="500" color="#CDADD9" />
      <Node name="Ems" from="Toronto" value="300" color="#CDADD9" />
      <Node name="Financing" from="Toronto" value="1000" color="sea" />
      <Node name="Operations" from="Toronto" value="900" color="sea" />
      <Node name="Services" from="Toronto" value="700" color="sea" />
      <Node name="Accounts" from="Toronto" value="700" color="sea" />
      <Node name="Transportation" from="Toronto" value="400" color="sea" />
      <Node name="Other" from="Toronto" value="400" color="sea" />

      <!-- 

      <Node name="Police" from="Toronto" value="1130" color="sea" />
      <Node
        name="TTC"
        from="Toronto"
        value="2100"
        color="#6E9588"
        accent="lightsteelblue" />
      <Node name="Fire" from="Toronto" value="479" color="red" />
      <Node name="Social Programs" from="Toronto" value="3300" color="red" />
      <Node name="Services" from="Toronto" value="1940" color="red" /> -->
    </Col>

  </Sankey>

  <Foot />
</div>
