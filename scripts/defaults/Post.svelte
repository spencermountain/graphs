<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  export let title = ''
  export let sub = ''
</script>

<style>

</style>

<div>
  <stage>
    <Head {title} {sub} />
    <div>hello</div>
  </stage>
  <Foot {title} />
</div>
