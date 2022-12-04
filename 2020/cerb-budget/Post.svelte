<script>
  import { Page } from '../../components/index.mjs'
  import { Sankey, Node, Col } from '/Users/spencer/mountain/somehow-sankey/src'
  let fmt = (num) => {
    num = Number(num) * 1000000000
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
  let title = `Canada's Budget with CERB benefit`
  let sub = 'in 2020'
</script>

<Page {title} {sub}>
  <!-- <div class="m3">
    <b>Canada's Budget with CERB benefit</b>
    <br />
    in 2020
  </div> -->
  <div class="m3">
    <Sankey height="800" {fmt}>
      <Col>
        <Node name="Income Tax" to="Canada" value="164" color="sea" />
        <Node name="Corporate Tax" to="Canada" value="45" color="sea" />
        <Node name="GST" to="Canada" value="37" color="sea" />
        <Node name="EI" to="Canada" value="23" color="sea" />
        <Node name="Crown" to="Canada" value="12" color="sea" />
        <Node name="Customs" to="Canada" value="5" color="sea" />
      </Col>
      <Col>
        <Node name="Canada" value="319" color="orange" accent="red" />
      </Col>
      <Col>
        <Node name="CERB" from="Canada" value="62" color="red" />

        <Node name="Seniors" from="Canada" value="57" color="blue" />
        <Node name="Child services" from="Canada" value="22" color="blue" />
        <Node name="Defence" from="Canada" value="25" color="blue" />
        <Node name="EI" from="Canada" value="20" color="blue" />
        <Node name="Equalization" from="Canada" value="19" color="green" />
        <Node name="Health Transfer" from="Canada" value="39" color="green" />
        <Node name="Social Transfer" from="Canada" value="14" color="green" />
        <Node name="CEBA" from="Canada" value="26" color="orange" opacity="0.5" accent="lighter" />
      </Col>
    </Sankey>
  </div>
</Page>

<style>
  .m3 {
    margin-right: 3rem;
    margin-top: 2rem;
    margin-bottom: 2rem;
  }
</style>
