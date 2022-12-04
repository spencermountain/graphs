<script>
  export let xScale = () => {}
  import spacetime from 'spacetime'

  // let ticks = ['1966', '1972', '1980-01-01', '1991-01-01', '1997-01-01', '2003-01-01', '2010', '2014'] //, '2030'
  let ticks = ['1970-01-01', '1980-01-01', '1990-01-01', '2000-01-01', '2010-01-01', '2020-01-01'] //, '2030'
</script>

<div class="bottom">
  {#each ticks as str}
    <div class="rel tick" style="left:{xScale(str)}%; bottom:0%;">{spacetime(str).year()}</div>
  {/each}
</div>

<style>
  .bottom {
    height: 25px;
    left: 0px;
    width: 100%;
    border-top: 1px solid lightgrey;
    /* background-color: whitesmoke; */
    position: absolute;
    bottom: -25px;
  }
  .tick {
    position: absolute;
    color: grey;
    font-size: 14px;
    /* margin-left: -8px; */
  }
  @media only screen and (max-width: 400px) {
    .tick {
      display: none;
    }
  }
</style>
