<script>
  import { Page } from '../../components/index.mjs'
  export let title = 'Population of Ontario'
  export let sub = ''

  import { Sankey, Node, Col } from '/Users/spencer/mountain/somehow-sankey'
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

<Page {title} {sub}>
  <div class="m3">
    <Sankey height="1000" {fmt} nodeWidth={90}>
      <!-- https://en.wikipedia.org/wiki/List_of_cities_in_Canada -->
      <!-- https://en.wikipedia.org/wiki/Golden_Horseshoe -->
      <Col>
        <Node name="Downtown" to="Toronto" value="0.9" color="sea" />
        <Node name="North York" to="Toronto" value="0.869" color="sea" />
        <Node name="Scarborough" to="Toronto" value="0.6" color="sea" show_num={false} />
        <Node name="Etobicoke" to="Toronto" value="0.345" color="sea" show_num={false} />
        <!-- <Node name="York" to="Toronto" value="0.145" color="sea" /> -->
        <!-- <Node name="East York" to="Toronto" value="0.118" color="sea" /> -->
      </Col>
      <Col>
        <Node name="Toronto" to="Greater Toronto" value="2.7" color="sea" />
        <Node name="Missisauga" to="Greater Toronto" value="0.828" color="mud" show_num={false} />
        <Node name="Brampton" to="Greater Toronto" value="0.6" color="mud" show_num={false} />
        <Node name="Oakville" to="Greater Toronto" value="0.2" color="mud" show_num={false} />
        <Node name="Markham" to="Greater Toronto" value="0.301" color="mud" show_num={false} />
        <Node name="Vaughn" to="Greater Toronto" value="0.288" color="mud" show_num={false} />
        <Node
          name="Richmond Hill"
          to="Greater Toronto"
          value="0.185"
          color="mud"
          show_num={false}
        />
        <Node name="Burlington" to="Greater Toronto" value="0.175" color="mud" show_num={false} />
        <!-- <Node name="Peel" to="Greater Toronto" value="1.3" color="burn" /> -->
        <!-- <Node name="Halton" to="Greater Toronto" value="0.5" color="mud" /> -->
        <!-- <Node name="Durham" to="Greater Toronto" value="0.6" color="slate" /> -->
      </Col>
      <Col>
        <Node name="Greater Toronto" to="Ontario" value="6" color="sky" />
        <Node name="Hamilton" to="Ontario" value="0.53" color="mud" />
        <Node name="Kitchener" to="Ontario" value="0.2" color="mud" show_num={false} />
        <Node name="London" to="Ontario" value="0.366" color="mud" show_num={false} />
        <Node name="Oshawa" to="Ontario" value="0.159" color="mud" show_num={false} />
        <!-- <Node name="St. Catharines" to="Ontario" value="0.13" color="mud" /> -->
        <Node name="Sudbury" to="Ontario" value="0.161" color="mud" show_num={false} />
        <Node name="Barrie" to="Ontario" value="0.14" color="mud" show_num={false} />
        <Node name="Ottawa" to="Ontario" value="0.9" color="red" stroke={'#d7d5d2'} />
        <Node name="Windsor" to="Ontario" value="0.21" color="mud" show_num={false} />
      </Col>
      <Col>
        <Node name="Ontario" to="Canada" value="14" color="blue" />
      </Col>
    </Sankey>
  </div>
</Page>

<style>
  .m3 {
    margin-right: 6rem;
    margin-top: 2rem;
    margin-bottom: 2rem;
  }
</style>
