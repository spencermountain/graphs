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

<div>
  <Head num="17" />
  <div class="m3">
    <b>Canada's Budget with CERB benefit</b>
    <br />
    in 2020
  </div>
  <div class="main m3 row">
    <Sankey height="750" {fmt}>
      <Col>
        <Node name="Income Tax" to="Canada" value="164" color="sea" />
        <Node name="Corporate Tax" to="Canada" value="45" color="sea" />
        <Node name="GST" to="Canada" value="37" color="sea" />
        <Node name="EI" to="Canada" value="23" color="sea" />
        <Node name="Crown" to="Canada" value="12" color="sea" />
        <Node name="Customs" to="Canada" value="5" color="sea" />

      </Col>
      <Col>
        <Node name="Canada" value="319" color="orange" />
      </Col>
      <Col>

        <Node name="CERB" from="Canada" value="62.75" color="red" />

        <Node name="Seniors" from="Canada" value="57" color="blue" />
        <Node name="Children" from="Canada" value="22" color="blue" />
        <Node name="Defence" from="Canada" value="25" color="blue" />
        <Node name="EI" from="Canada" value="20.7" color="blue" />
        <Node name="Equalization" from="Canada" value="19" color="green" />
        <Node name="Health Transfer" from="Canada" value="39" color="green" />
        <Node name="Social Transfer" from="Canada" value="14" color="green" />

      </Col>

    </Sankey>
  </div>

  <Foot />
</div>
