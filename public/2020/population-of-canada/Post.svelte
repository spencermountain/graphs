<script>
  import { Page } from '../../components/index.mjs'
  import { Sankey, Node, Col } from '/Users/spencer/mountain/somehow-sankey/src'
  export let title = 'Population of Canada'
  //from Wikipedia by Metro area
  // https://en.wikipedia.org/wiki/Metropolitan_area

  let fmt = (num) => {
    num = Number(num) * 1000000
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

<Page {title}>
  <div class="m3">
    <Sankey height="1100" {fmt}>
      <Col>
        <Node name="Greater Toronto" to="Ontario" value="6" color="sky" />
        <Node name="Ottawa" to="Ontario" value="1" color="sky" />
        <Node name="Greater Montreal" to="Quebec" value="4" color="mud" />
        <Node name="Greater Vancouver" to="B.C." value="2.4" color="burn" />
        <Node name="Calgary" to="Alberta" value="1.3" color="greygreen" />
      </Col>

      <Col>
        <Node name="Ontario" to="Canada" value="14" color="sky" col={1} />
        <Node name="Quebec" to="Canada" value="8" color="mud" col={1} />
        <Node name="B.C." to="Canada" value="5" color="burn" col={1} />
        <Node name="Alberta" to="Canada" value="4" col={1} color="greygreen" />
        <Node name="Nova Scota" to="Canada" value="1" col={1} />
        <Node name="Manitoba" to="Canada" value="1" col={1} />
        <Node name="Saskatchewan" to="Canada" value="1" col={1} />
      </Col>

      <Col>
        <Node name="Canada" color="red" col={2} />
      </Col>
    </Sankey>
  </div>
</Page>

<style>
  .m3 {
    margin-top: 2rem;
    margin-right: 4rem;
  }
</style>
