<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  export let title = ''
  export let sub = ''

  import { Sankey, Node, Col } from '/Users/spencer/mountain/somehow-sankey'
  let fmt = num => {
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

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} num="13" />
  <div class="m3">Population of Ontario</div>

  <Sankey height="1200" {fmt}>
    <!-- https://en.wikipedia.org/wiki/List_of_cities_in_Canada -->
    <!-- https://en.wikipedia.org/wiki/Golden_Horseshoe -->
    <Col>
      <Node name="Downtown" to="Toronto" value="0.9" color="sea" />
      <Node name="North York" to="Toronto" value="0.869" color="sea" />
      <Node name="Scarborough" to="Toronto" value="0.6" color="sea" />
      <Node name="Etobicoke" to="Toronto" value="0.345" color="sea" />
      <!-- <Node name="York" to="Toronto" value="0.145" color="sea" /> -->
      <!-- <Node name="East York" to="Toronto" value="0.118" color="sea" /> -->

    </Col>
    <Col>
      <Node name="Toronto" to="Greater Toronto" value="2.7" color="sea" />
      <Node name="Missisauga" to="Greater Toronto" value="0.828" color="mud" />
      <Node name="Brampton" to="Greater Toronto" value="0.6" color="mud" />
      <Node name="Oakville" to="Greater Toronto" value="0.2" color="mud" />
      <Node name="Markham" to="Greater Toronto" value="0.301" color="mud" />
      <Node name="Vaughn" to="Greater Toronto" value="0.288" color="mud" />
      <Node name="Richmond Hill" to="Greater Toronto" value="0.185" color="mud" />
      <Node name="Burlington" to="Greater Toronto" value="0.175" color="mud" />
      <!-- <Node name="Peel" to="Greater Toronto" value="1.3" color="burn" /> -->
      <!-- <Node name="Halton" to="Greater Toronto" value="0.5" color="mud" /> -->
      <!-- <Node name="Durham" to="Greater Toronto" value="0.6" color="slate" /> -->

    </Col>
    <Col>
      <Node name="Greater Toronto" to="Ontario" value="6" color="sky" />
      <Node name="Hamilton" to="Ontario" value="0.53" color="mud" />
      <Node name="Kitchener" to="Ontario" value="0.2" color="mud" />
      <Node name="London" to="Ontario" value="0.366" color="mud" />
      <Node name="Oshawa" to="Ontario" value="0.159" color="mud" />
      <!-- <Node name="St. Catharines" to="Ontario" value="0.13" color="mud" /> -->
      <Node name="Sudbury" to="Ontario" value="0.161" color="mud" />
      <Node name="Barrie" to="Ontario" value="0.14" color="mud" />
      <Node name="Ottawa" to="Ontario" value="0.9" color="red" />
      <Node name="Windsor" to="Ontario" value="0.21" color="mud" />
    </Col>
    <Col>
      <Node name="Ontario" to="Canada" value="14" color="blue" />
    </Col>
  </Sankey>

  <Foot {title} />
</div>
