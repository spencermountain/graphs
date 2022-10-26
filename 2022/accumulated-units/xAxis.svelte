<script>
  export let xScale = () => {}
  import spacetime from 'spacetime'

  // let ticks = ['1966', '1972', '1980-01-01', '1991-01-01', '1997-01-01', '2003-01-01', '2010', '2014'] //, '2030'
  let ticks = ['13 November 2006', 'October 25, 2010', 'October 27, 2014', 'October 22, 2018', 'October 22, 2022'] //, '2030'
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
    /* border-top: 1px solid lightgrey; */
    /* background-color: whitesmoke; */
    position: absolute;
    bottom: -55px;
  }
  .tick {
    position: absolute;
    color: grey;
    font-size: 15px;
    /* margin-left: -8px; */
  }
</style>
