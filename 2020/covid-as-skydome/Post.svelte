<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  export let title = ''
  export let sub = ''
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  img {
    max-width: 100%;
  }
</style>

<div>
  <Head {title} {sub} num="12" />
  <div class="m3">
    Covid-deaths as percentage of skydome
    <div>as of June 8th, 2020</div>
  </div>
  <div class="m3">
    <img src="./assets/third-covid.jpg" class="shadow " />
    <div>skydome: 53,000</div>
    <div>covid deaths: 7,835</div>
  </div>
  <Foot {title} />
</div>
