<script>
  import counts from './counts.js'
  let sum = counts.reduce((h, a) => {
    h += a.total
    return h
  }, 0)

  import { Sankey, Node, Col, Label } from '/Users/spencer/mountain/somehow-sankey/src/index.mjs'
  let fmt = (num) => {
    // num = Number(num) * 1000000
    // if (num >= 1000000000) {
    //   num = Math.round(num / 100000000) * 100000000
    //   num = Math.round(num)
    //   return String(num / 1000000000) + 'b'
    // }
    // if (num >= 1000000) {
    //   num = Math.round(num / 100000) * 100000
    //   num = Math.round(num)
    //   return String(num / 1000000) + 'm'
    // }
    if (num > 1000) {
      num = Math.round(num / 1000) * 1000
      return String(num / 1000) + 'k'
    }
    return num
  }
  // points = data
</script>

<div class="center">
  <div class="m3">Development applications by number of units</div>
  <div class="container">
    <Sankey height="700" {fmt}>
      <Col>
        <Node name="Proposed Units" value={sum} color="sea" />
      </Col>
      <Col>
        <Node
          name={counts[0].name}
          from="Proposed Units"
          value={counts[0].total}
          color="steelblue"
        />
        <Node name={counts[1].name} from="Proposed Units" value={counts[1].total} color="#c4abab" />
        <Node
          name={counts[2].name}
          from="Proposed Units"
          value={counts[2].total}
          color="steelblue"
        />
        <!-- {#each counts as o, i}
          <Node name={o.name} from="Proposed Units" value={o.total} color="steelblue" />
        {/each} -->
      </Col>
      <!-- <Col>
        {#each counts as o, i}
          <Node name="Pending" from={o.name} value={o.pending} color="#c4abab" />
          <Node name="Issued" from={o.name} value={o.issued} color="blue" />
        {/each}
      </Col> -->
    </Sankey>
    <div class="source">
      filtered <a href="https://open.toronto.ca/dataset/building-permits-active-permits/"
        >Active building permits</a
      >
      - toronto.ca, Sep 2022
    </div>
  </div>
</div>

<style>
  .center {
    text-align: center;
    margin: 3rem;
  }
  .container {
    max-width: 800px;
    min-width: 400px;
    margin-top: 3rem;
  }
  .source {
    margin: 3rem;
    font-size: 12px;
    color: grey;
    text-align: right;
  }
  .m3 {
  }
</style>
