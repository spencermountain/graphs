<script>
  export let href = '#'
  export let color = '#303b50'
  export let label = ''
  export let title = ''
  let hover = false
</script>

<a {href} class="container">
  <svg width="15px" height="30px" viewBox="0 0 90 170">
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linejoin="round">
      <path
        d="M81.5,6 C69.8240666,23.5139001 45.8240666,49.9277635 9.5,85.2415902
        C45.7984814,120.80686 69.7984814,147.22633 81.5,164.5"
        stroke={color}
        stroke-width="20"
        fill-rule="nonzero"
      />
    </g>
  </svg>
  {#if hover}
    <div class="name">{label}</div>
  {/if}
</a>

<style>
  .goleft {
  }
  .container {
    align-self: flex-start;
    margin: 1rem;
    padding: 1rem;
    height: 20px;
    transition: margin-left 250ms;
  }
  .name {
    font-size: 0.5rem;
    color: grey;
  }

  .container:hover {
    margin-left: 0.8rem;
  }
</style>
