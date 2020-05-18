<script>
  export let d = ''
  let hovering

  function enter() {
    hovering = true
  }

  function leave() {
    hovering = false
  }
</script>

{#if hovering}
  <path
    {d}
    stroke="red"
    fill="none"
    on:mouseenter={enter}
    on:mouseleave={leave}
    stroke-width="5px" />
{:else}
  <path
    {d}
    stroke="steelblue"
    fill="none"
    stroke-width="1px"
    on:mouseenter={enter}
    on:mouseleave={leave} />
{/if}
