<script>
  import { Page } from '../../components/index.mjs'
  import counts from './counts.js'
  let title = "Toronto's missing middle"
  let sum = counts.reduce((h, a) => {
    h += a.total
    return h
  }, 0)

  import { Sankey, Node, Col } from '/Users/spencer/mountain/somehow-sankey/src/index.mjs'
  let fmt = (num) => {
    if (num > 1000) {
      num = Math.round(num / 1000) * 1000
      return String(num / 1000) + 'k'
    }
    return num
  }
</script>

<Page {title} sub="Building applications, by number of units" height="780" width="700">
  <div class="rel">
    <div class="label">
      ← Missing middle
      <div style="font-size:12px;">2-12 unit buildings</div>
    </div>
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
        <Node name={''} from="Proposed Units" value={counts[1].total} color="#c4abab" />
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
  </div>
</Page>

<!-- <div class="source">
  filtered <a href="https://open.toronto.ca/dataset/building-permits-active-permits/"
    >Active building permits</a
  >
  - toronto.ca, Sep 2022
</div> -->
<style>
  .rel {
    position: relative;
    margin-top: 2rem;
  }
  .label {
    position: absolute;
    min-width: 200px;
    top: 88%;
    left: 460px;
    color: #c4abab;
  }
</style>
