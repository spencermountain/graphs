<script>
  // import { Sankey, Node } from '/Users/spencer/mountain/somehow-sankey/src/index.mjs'
  import { Sankey, Node, Col } from '/Users/spencer/mountain/somehow-sankey/src/index.mjs'
  import { Page } from '../../components/index.mjs'
  export let title = '2019 Budget of the Toronto Maple Leafs'
</script>

<Page {title} sub="(in millions)">
  <div style="margin-right:3rem; margin-top:2rem;">
    <Sankey height="800" nodeWidth={125}>
      <Col>
        <Node
          color="greypurple"
          name="NHL"
          to="Leafs"
          value="8"
          order={1}
          show_percent={true}
          show_num={false}
          stroke={'#d7d5d2'}
        />
        <Node
          color="sky"
          name="Tickets"
          to="Leafs"
          value="50"
          show_percent={true}
          show_num={false}
          stroke={'#d7d5d2'}
        />
        <Node
          color="sea"
          name="In-Arena"
          to="Leafs"
          value="20"
          show_percent={true}
          show_num={false}
          stroke={'#d7d5d2'}
        />
        <Node
          color="mud"
          name="LocalTV"
          to="Leafs"
          value="5"
          show_percent={true}
          show_num={false}
          stroke={'#d7d5d2'}
        />
      </Col>
      <Col width={150}>
        <Node name="Leafs" value="83" show_percent={false} show_num={false} stroke={'#d7d5d2'} />
      </Col>
      <Col>
        <Node
          color="red"
          name="Player Salary"
          from="Leafs"
          value="75"
          show_percent={true}
          show_num={false}
          stroke={'#d7d5d2'}
        />
        <Node
          color="greygreen"
          name="Coach"
          from="Leafs"
          value="6"
          show_percent={true}
          show_num={false}
          stroke={'#d7d5d2'}
        />
      </Col>
    </Sankey>
  </div>
</Page>

<style>
</style>
