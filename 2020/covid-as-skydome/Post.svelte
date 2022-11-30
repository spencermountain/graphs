<script>
  import { Page } from '../../components/index.mjs'
  export let title = 'Canadian Covid deaths as percentage of skydome'
  export let sub = '- as of June 8th, 2020'
</script>

<Page {title} {sub}>
  <img alt="covid deaths as % of Skydome seats" src="./assets/third-covid.jpg" class="shadow " />
  <ul>
    <div>skydome: 53,000</div>
    <div>covid deaths: 7,835</div>
  </ul>
</Page>

<style>
  img {
    width: 100%;
    margin: 0px;
    padding: 0px;
    border-radius: 5px;
  }
</style>
