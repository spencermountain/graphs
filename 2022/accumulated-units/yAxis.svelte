<script>
  export let yScale = () => {}
  export let ticks = []
  import fmt from './lib/fmt.js'
</script>

<div class="left">
  {#each ticks as n, i}
    <div class="rel tick" style="bottom:{yScale(n)}%;">+{fmt(n - (ticks[i - 1] || 0))}</div>
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
    font-size: 14px;
    height: 16px;
    margin-top: -16px;
  }
</style>
