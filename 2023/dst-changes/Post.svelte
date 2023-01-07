<script>
  import { Head, Foot } from '../../components/index.mjs'
  import getYear from './lib/build.js'
  let year = 2023
  $: dots = getYear(year)
  $: yearStart = new Date(`${year}-01-01`).getTime()
  $: yearEnd = new Date(`${year}-12-31T11:59`).getTime()

  //a very-tiny linear scale
  const scaleLinear = function (obj) {
    let world = obj.world || []
    let minmax = obj.minmax || obj.minMax || []
    const calc = (num) => {
      let range = minmax[1] - minmax[0]
      let percent = (num - minmax[0]) / range
      let size = world[1] - world[0]
      return parseInt(size * percent, 10)
    }

    return calc
  }

  $: scale = scaleLinear({
    world: [0, 100],
    minMax: [yearStart, yearEnd],
  })
  let title = 'DST changes by year'
</script>

<div class="page">
  <Head {title} sub="" />
  <div class="mid">
    <div class="shadow container">
      <div class="rightSide">
        <input type="button" value="←" on:click={() => (year -= 1)} />
        <span class="year">{year}</span>
        <input type="button" value="→" on:click={() => (year += 1)} />
      </div>
      <div class="col box">
        {#each dots as dot, i}
          <div class="row" style="width:100%;">
            <div class="name">{dot.name}</div>
            <div class="line">
              <div class="track" />
              <div
                class="inside"
                title={dot.name}
                style="left:{scale(dot.start.epoch)}%; width:{scale(dot.end.epoch) -
                  scale(dot.start.epoch)}%"
              />
              <div class="dot" title={dot.name} style="left:{scale(dot.start.epoch)}%;" />
              <div class="dot end" title={dot.name} style="left:{scale(dot.end.epoch)}%;" />
            </div>
          </div>
        {/each}
      </div>
    </div>
    <Foot {title} year="2023" />
  </div>
</div>

<style>
  .name {
    width: 150px;
  }
  .container {
    display: flex;
    flex-direction: column;
  }
  .rightSide {
    justify-content: flex-end;
    display: flex;
    margin-right: 3rem;
    align-items: center;
  }
  .year {
    font-size: 2.5rem;
    margin: 1rem;
  }
  input {
    font-size: 1.4rem;
    height: 40px;
  }
  .box {
    margin: 3rem;
    margin-top: 1rem;
    /* border: 1px solid grey; */
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
    border-radius: 5px;
    padding: 3rem;
  }
  .dot {
    width: 20px;
    height: 20px;
    background-color: #4386cc;
    border-radius: 50%;
    position: absolute;
    top: 0px;
  }
  .track {
    height: 3px;
    top: 9px;
    border-radius: 3px;
    box-shadow: 1px 1px 8px 0px rgba(0, 0, 0, 0.1);
    position: absolute;
    background-color: lightgrey;
    width: 100%;
  }
  .end {
    background-color: steelblue;
  }
  .inside {
    height: 20px;
    /* background-color: #f6f4e9; */
    /* opacity: 0.5; */
    position: absolute;
    margin-left: 10px;
    top: 0px;
    background-color: #d6e0ec;
  }
  .line {
    /* background-color: #d7d5d2; */
    z-index: 3;
    position: relative;
    /* width: 100%; */
    flex-grow: 1;
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
    height: 20px;
  }
  .col {
    display: flex;
    flex-direction: column;
    justify-content: stretch;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
  }
  .row {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: nowrap;
    align-self: stretch;
  }
</style>
