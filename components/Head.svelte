<script>
  export let href = '#'
  export let title = ''
  export let sub = ''
  export let color = '#769bb5'
</script>

<div {href} class="goleft">
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
</div>
<div class="titlebox">
  <div class="title">{@html title}</div>
  <div class="sub">{sub}</div>
</div>

<style>
  .goleft {
    align-self: flex-start;
    transition: margin-left 250ms;
    padding: 2rem;
    padding-top: 1rem;
    cursor: pointer;
  }
  .goleft:hover {
    margin-left: 0.8rem;
  }
  .title {
    font-size: 18px;
  }
  .sub {
    margin-left: 3rem;
    color: grey;
    text-align: right;
    margin-top: 5px;
  }
  .titlebox {
    width: 400px;
  }
</style>
