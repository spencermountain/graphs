<script>
  import Head from './Head.svelte'
  import Foot from './Foot.svelte'
  export let title = ''
  export let sub = ''
  export let padding = 16
  export let year = String(new Date().getFullYear())
</script>

<div class="page">
  <Head {title} {sub} />
  <div class="mid" style="">
    <div class="shadow" style="padding:{padding}px;">
      <slot />
    </div>
    <Foot {title} {year} />
  </div>
</div>

<style>
  /* everything */
  .page {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    text-align: center;
  }

  /* invisible-middle-column */
  .mid {
    margin: 1rem;
    padding: 1rem;
    margin-top: 0rem;
    min-width: 300px;
    flex-grow: 1;
  }

  /* visible middle-column */
  .shadow {
    padding: 2rem;
    min-height: 600px;
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  }
</style>
