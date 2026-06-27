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
  let title = `Canada's Population on CERB benefit`
  let sub = `in 2020`
</script>

<Page {title} {sub}>
  <!-- <div class="m3">
    <b>Canada's Population on CERB benefit</b>
    <br />
    in 2020
  </div> -->
  <div class="main m3 row">
    <Sankey height="750" {fmt}>
      <Col>
        <Node name="CERB" to="Working Age" value="8.5" color="red" />
        <Node name="CPP/OAS" to="Retired" value="6.5" color="blue" />
      </Col>
      <Col>
        <Node name="Young" to="Canada" value="8" color="blue" />
        <Node name="Working Age" to="Canada" value="22" color="sky" />
        <Node name="Retired" to="Canada" value="6.5" color="blue" />
      </Col>
      <Col>
        <Node name="Canada" value="30" color="orange" accent="red" />
      </Col>
    </Sankey>
  </div>
</Page>

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
