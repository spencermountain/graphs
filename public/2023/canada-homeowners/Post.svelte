<script>
  import { Head, Foot } from '../../components/index.mjs'
  import { Vertical, Bar } from '/Users/spencer/mountain/somehow-barchart/src'
  import data from './data.js'
  import color from './color.js'
  let title = 'Home ownership in canada'
  let size = window.innerWidth
  $: selected = 10
  const percent = (part, total) => {
    let num = (part / total) * 100
    num = Math.round(num * 10) / 10
    return num
  }
  $: lineX = (n) => {
    let len = data.length
    let x = len - n
    return percent(x, len) - 2
  }
</script>

<svelte:window bind:innerWidth={size} />

<div class="page">
  <Head {title} sub="" />
  <div class="mid">
    <div class="graph">
      <div class="label">population</div>
      <Vertical height="230px" max={4288365} axis={true}>
        <div class="total" style="width:{lineX(selected)}%">
          &nbsp; &nbsp;{parseInt(data[selected].percentage, 10)}%
          <span class="smol">population:</span>
          <div style="position:absolute; left:-5px; top:13px; color:lightgrey;">|</div>
        </div>
        {#each data as age, i}
          <Bar
            color={color(age.rate)}
            notWhite={true}
            hover={() => (selected = i)}
            click={() => (selected = i)}
            value={age.total}
            label={age.label.split(' ')[0]}
          />
        {/each}
      </Vertical>
    </div>

    <div class="graph">
      <div class="label">home ownership rate:</div>
      <div class="total" style="width:{lineX(selected)}%">
        &nbsp; &nbsp;{parseInt(data[selected].cumulative, 10)}% <span class="smol">houses</span>
        <div style="position:absolute; left:-5px; top:13px; color:lightgrey;">|</div>
      </div>
      <Vertical height="230px" max={1.2} axis={true}>
        {#each data as age, i}
          <Bar
            color={color(age.rate)}
            notWhite={true}
            value={age.rate}
            hover={() => (selected = i)}
            click={() => (selected = i)}
            label={age.label.split(' ')[0] || ''}
            show={parseInt(age.rate * 100, 10) + '%'}
            title={age.start}
          />
        {/each}
      </Vertical>
    </div>
    <Foot {title} year="2023" />
  </div>
</div>

<style>
  .total {
    position: absolute;
    right: 0px;
    width: 50%;
    top: 4rem;
    border-bottom: 1px solid lightgrey;
    color: grey;
  }
  .total:before {
    /* content: '>'; */
  }
  .smol {
    font-size: 0.8rem;
    color: grey;
    margin-left: 0.3rem;
  }
  .graph {
    margin: 2rem;
    margin-bottom: 10rem;
    margin-top: 4rem;
    position: relative;
  }
  .label {
    text-align: left;
    height: 4rem;
  }
</style>
