<script>
  let year = new Date().getFullYear()
  export let num = '01'
  // export let title = ''
  // export let sub = ''
</script>

<style>
  .blue {
    color: #69c;
  }
  .goleft {
    align-self: flex-start;
  }
  .f1 {
    font-size: 1rem;
  }
  a {
    color: #69c;
    cursor: pointer;
    text-decoration: underline;
  }
  a:hover {
    text-decoration-color: #cc7066;
  }
</style>

<!-- title -->
<div class="blue ml1 goleft left">
  <a class="link f1 blue" href="../../">〱 ./{year}/ {num}</a>
  <!-- <span class="ml2 grey">{title}</span> -->
  <!-- <div class="brown ml1">{sub}</div> -->
</div>
