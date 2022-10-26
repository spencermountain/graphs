<script>
  export let yScale = () => {}
  import spacetime from 'spacetime'
  let max = 3000000
  let ticks = [2000000, 2500000, 3000000]
  const fmt = n => {
    if (n > 1000000) {
      n = (n / 1000000).toLocaleString() + 'm'
      return String(n)
    }
    // if (n > 1000) {
    //   return (n / 1000).toLocaleString() + 'k'
    // }
    return n
  }
</script>

<div class="left">
  {#each ticks as n}
    <div class="rel tick" style="top:{yScale(n)}%;">{fmt(n)}</div>
  {/each}
</div>

<style>
  .left {
    position: absolute;
    top: 0px;
    height: 100%;
    width: 40px;
    left: -45px;
    padding-right: 5px;
    border-right: 1px solid lightgrey;
    /* background-color: whitesmoke; */
    text-align: right;
  }
  .tick {
    text-align: right;
    width: 35px;
    position: absolute;
    color: grey;
    font-size: 16px;
    height: 16px;
    margin-top: -16px;
  }
</style>
