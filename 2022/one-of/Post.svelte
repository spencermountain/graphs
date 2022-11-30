<script>
  import { Page } from '../../components/index.mjs'
  let title = `One out of <select id="select">
    <option value="100" default>100</option>
    <option value="1000">1,000</option>
    <option value="10000">10,000</option>
    <option value="100000" >100,000</option>
    <option value="1000000">1,000,000</option>
    </select>`
  let boxes = 4
  let grid = 5
  let tiny = false
  let tinier = false
  let expand = false
  import { onMount } from 'svelte'

  onMount(() => {
    document.querySelector('#select').onchange = function (e) {
      let val = Number(e.target.value)
      tiny = false
      expand = false
      tinier = false
      if (val === 100) {
        grid = 5 // 5*5=25
      } else {
        grid = 10 // 10*10=100
      }
      let perBox = grid * grid
      boxes = val / perBox
      if (boxes >= 10) {
        tiny = true
      }
      if (boxes > 100) {
        expand = true
      }
      if (boxes >= 100) {
        tinier = true
      }
      console.log('boxes:', boxes)
      console.log('perbox:', perBox)
    }
  })
</script>

<Page {title}>
  <div class="all row" class:expand>
    {#each Array(boxes - 1) as _, i}
      <div class="box" class:tiny class:tinier class:light={boxes >= 1000 && Math.random() > 0.8} />
    {/each}
    <div class="box col" class:tiny class:tinier>
      {#each Array(grid) as _, i}
        <div class="row">
          {#each Array(grid) as _, i}
            <div class="one" class:square={tiny} />
          {/each}
        </div>
      {/each}
    </div>
  </div>
</Page>

<style>
  .all {
    /* width: 80vw; */
    width: 400px;
  }
  .expand {
    width: 800px;
  }
  .row {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
    flex-grow: 1;
  }
  .row:last-child > .one:first-child {
    border-top: 1px solid #52d1dae6;
    border-right: 1px solid #52d1dae6;
    /* background-color: rgba(220, 220, 220, 0.9); */
    /* background-color: #f0f1f3; */
    background-color: #2cc4cee6;
    box-shadow: 4px 4px 18px 2px rgba(0, 0, 0, 0.3);
    border-radius: 5px;
  }
  .light {
    background-color: #629edf !important;
  }
  .one {
    flex-grow: 1;
    height: 100%;
  }
  .square {
    border-radius: 2px !important;
  }
  .tiny {
    width: 150px !important;
    height: 150px !important;
    margin: 5px !important;
    border-radius: 2px !important;
  }
  .tinier {
    width: 70px !important;
    height: 70px !important;
    margin: 5px !important;
    border-radius: 0px !important;
  }
  .box {
    display: inline-block;
    width: 300px;
    height: 300px;
    background-color: #438ee1;
    margin: 1rem;
    border-radius: 15px;
    /* border-radius: 3px; */
    /* box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2); */
  }
  .col {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
  }
</style>
