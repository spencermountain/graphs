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
    font-size: 0.8rem;
  }
  a {
    color: #69c;
    cursor: pointer;
    padding: 1px;
    text-decoration: none;
    border-bottom: 1px solid #69c;
  }
  .link:hover {
    text-decoration-color: #cc7066;
    font-weight: 500;
    /* border-bottom: 1px solid#cc7066; */
    border-bottom: 1px solid #23415a;
  }
</style>

<!-- title -->
<div class="blue ml1 goleft left">
  <a class="link f1 blue" href="../../">〱 ./{year}/ {num}</a>
  <!-- <span class="ml2 grey">{title}</span> -->
  <!-- <div class="brown ml1">{sub}</div> -->
</div>
