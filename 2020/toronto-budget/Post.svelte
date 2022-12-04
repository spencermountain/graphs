<script>
  import { Page } from '../../components/index.mjs'
  import { Sankey, Node, Col } from '/Users/spencer/mountain/somehow-sankey/src'
  let fmt = (num) => {
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
  let title = `Toronto City Budget`
  let sub = 'in 2020'
</script>

<Page {title} {sub}>
  <div class="all">
    <Sankey height="900" {fmt}>
      <Col>
        <Node name="Property Taxes" to="Toronto" value="4400" color="sea" />
        <Node name="Province/Fed" to="Toronto" value="2500" color="red" stroke={'#d7d5d2'} />
        <Node name="TTC Fares" to="Toronto" value="1300" color="sky" stroke={'#d7d5d2'} />
        <Node name="Fees" to="Toronto" value="900" color="sky" stroke={'#d7d5d2'} />
        <Node name="Land-transfer" to="Toronto" value="800" color="sky" stroke={'#d7d5d2'} />
        <Node name="Misc" to="Toronto" value="600" color="sea" />
        <Node name="Investment" to="Toronto" value="300" color="sea" show_num={false} />
        <Node name="Reserves" to="Toronto" value="500" color="sea" show_num={false} />
        <Node name="Transfers" to="Toronto" value="300" color="sea" show_num={false} />
      </Col>
      <Col>
        <Node
          name="Toronto"
          value="11600"
          color="blue"
          full="87.2"
          append="* 1.5bn covid short-fall"
        />
      </Col>
      <Col>
        <!-- <Node name="Social Programs" from="Toronto" value="3300" color="#6E9588" />
      <Node name="TTC" from="Toronto" value="2100" color="red" />
      <Node name="Police" from="Toronto" value="1200" color="#CDADD9" />
      <Node name="Fire" from="Toronto" value="500" color="#CDADD9" />
      <Node name="Ems" from="Toronto" value="300" color="#CDADD9" />
      <Node name="Financing" from="Toronto" value="1000" color="sea" />
      <Node name="Operations" from="Toronto" value="900" color="sea" />
      <Node name="Services" from="Toronto" value="700" color="sea" />
      <Node name="Accounts" from="Toronto" value="700" color="sea" />
      <Node name="Transportation" from="Toronto" value="400" color="sea" />
      <Node name="Other" from="Toronto" value="400" color="sea" /> -->

        <Node name="Police" from="Toronto" value="1200" color="#CDADD9" stroke={'#d7d5d2'} />
        <Node name="Fire" from="Toronto" value="490" color="#CDADD9" stroke={'#d7d5d2'} />
        <Node name="Ems" from="Toronto" value="220" color="#CDADD9" show_num={false} />

        <Node name="Housing" from="Toronto" value="750" color="#8797B7" stroke={'#d7d5d2'} />
        <Node name="Child services" from="Toronto" value="630" color="#8797B7" stroke={'#d7d5d2'} />
        <Node name="Senior care" from="Toronto" value="260" color="#8797B7" show_num={false} />

        <Node name="TTC" from="Toronto" value="1900" color="red" stroke={'#d7d5d2'} />
        <Node name="Wheel-trans" from="Toronto" value="160" color="red" show_num={false} />

        <Node name="Unemployment" from="Toronto" value="1100" color="#8FAEA6" />
        <Node name="Library" from="Toronto" value="210" color="#8FAEA6" show_num={false} />
        <Node name="Parks" from="Toronto" value="450" color="#8FAEA6" show_num={false} />
        <Node name="Public health" from="Toronto" value="270" color="#8FAEA6" show_num={false} />
        <!-- <Node name="Planning" from="Toronto" value="100" color="#8FAEA6" /> -->
        <Node name="Water" from="Toronto" value="1200" color="sky" />

        <!-- <Node name="Fleet" from="Toronto" value="250" color="sea" /> -->
        <Node name="Roads" from="Toronto" value="420" color="sea" show_num={false} />
        <Node name="Garbage" from="Toronto" value="400" color="sea" show_num={false} />
        <Node name="Governace" from="Toronto" value="400" color="sea" show_num={false} />
        <Node name="Parking" from="Toronto" value="160" color="sea" show_num={false} />
        <Node name="Debt" from="Toronto" value="500" color="sea" show_num={false} />
        <Node name="Financing" from="Toronto" value="370" color="sea" show_num={false} />
        <Node name="Misc" from="Toronto" value="700" color="sea" />
        <!-- <Node name="non-program" from="Toronto" value="770" color="sea" /> -->
      </Col>
    </Sankey>
  </div>
</Page>

<style>
  .all {
    margin-right: 3rem;
    margin-top: 2rem;
  }
</style>
