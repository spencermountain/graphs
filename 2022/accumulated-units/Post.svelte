<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import scale from './lib/scale.js'
  import spacetime from 'spacetime'
  import XAxis from './xAxis.svelte'
  import YAxis from './yAxis.svelte'
  import data from './data.js'
  let title = 'Accumulated housing units in Toronto'

  let max = 158382 + 10458 - 35000
  // let max = 261730 + 9828
  let min = 0
  let start = spacetime('2007-01-01')
  let end = spacetime('2023-01-01')

  let sum = 0
  let sum_approved = 0
  data.forEach((o) => {
    o.already = sum
    o.already_approved = sum_approved
    sum += o.total
    sum_approved += o.approvals
  })

  let t1 = data[0].total + data[1].total + data[2].total + data[3].total
  let t2 = data[4].total + data[5].total + data[6].total + data[7].total
  let t3 = data[8].total + data[9].total + data[10].total + data[11].total
  let t4 = data[12].total + data[13].total + data[14].total + data[15].total

  let xScale = (str) =>
    scale({ world: [0, 100], minmax: [start.epoch, end.epoch] }, spacetime(String(str)).epoch)
  let yScale = (n) => scale({ world: [0, 100], minmax: [min, max] }, n)
  let yTicks = [t1, t1 + t2, t1 + t2 + t3, t1 + t2 + t3 + t4]
</script>

<Head {title} num="01" />
<div class="center">
  <div class="row" style="align-items:flex-end; justify-content: center;">
    <div class="" style="margin-top:20px; height:0px;color:grey;">Housing units added by term</div>
    <div
      class="group"
      style="margin-left:3rem; height:80px; max-width:3rem;min-width:3rem;margin-bottom:-1rem "
    >
      <div class="bar red" style="height:50%; bottom:0%; " />
      <div class="bar" style="height:80%; bottom:0%; left:50%;" />
      <div class="label" style="color:steelblue; top:19px; left:-4px">built</div>
      <div class="label" style="color:lightsteelblue; left:27px; top:-10px;">approved</div>
    </div>
  </div>

  <div class="container row">
    {#each data as o, i}
      <div class="group" style=" height:100%;">
        <div class="bar red" style="height:{yScale(o.total)}%; bottom:{yScale(o.already)}%; " />
        <div
          class="bar"
          style="height:{yScale(o.approvals)}%; bottom:{yScale(o.already)}%; left:50%;"
        />
      </div>
    {/each}
    <!-- <div class="today" style="left:{xScale('13 November 2006')}%;" /> -->
    <div class="today" style="margin-left:17px; left:{xScale('October 25, 2010')}%;" />
    <div class="today" style="margin-left:17px; left:{xScale('October 27, 2014')}%;" />
    <div class="today" style="margin-left:17px; left:{xScale('October 22, 2018')}%;" />
    <!-- <div class="today" style="margin-left:17px; left:{xScale('October 22, 2022')}%;" /> -->

    <div class="total" style="width:{xScale('October 25, 2010') - 5}%; bottom:{yScale(t1)}%;" />
    <div
      class="total"
      style="width:{xScale('October 27, 2014') - 5}%; bottom:{yScale(t1 + t2) - 0.5}%;"
    />
    <div
      class="total"
      style="width:{xScale('October 22, 2018') - 5}%; bottom:{yScale(t1 + t2 + t3) - 0.9}%;"
    />
    <div
      class="total"
      style="width:{xScale('October 22, 2022') - 5}%; bottom:{yScale(t1 + t2 + t3 + t4) - 1.5}%;"
    />
    <XAxis {xScale} />
    <YAxis {yScale} ticks={yTicks} />

    <div class="row bars">
      <div class="term col" style="border-top:2px solid lightgrey;">Miller #2</div>
      <div class="term col" style="border-top:2px solid lightgrey;">Ford</div>
      <div class="term col" style="border-top:2px solid lightgrey;">Tory #1</div>
      <div class="term col" style="border-top:2px solid lightgrey;">Tory #2</div>
    </div>
  </div>
</div>
<Foot {title} />

<style>
  .bars {
    position: absolute;
    width: 100%;
    color: grey;
    bottom: -55px;
  }
  .term {
    /* border-radius: 5px; */
    color: grey;
    padding: 0.3rem;
    font-size: 11px;
    line-height: 15px;
    font-weight: 100;
    flex: 1;
    margin-top: 15px;
    margin-bottom: 5px;
    margin-left: 27px;
    margin-right: 27px;
    height: 20px;
    display: inline-block;
    opacity: 0.8;
  }
  .label {
    position: absolute;
    font-size: 12px;
  }
  .today {
    height: 80%;
    position: absolute;
    top: 18%;
    border-left: 2px dashed lightgrey;
    margin-left: 12px;
  }
  .total {
    position: absolute;
    left: 0px;
    height: 2px;
    border-top: 2px dashed grey;
    margin-left: 12px;
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
  .group {
    flex: 1;
    margin: 10px;
    position: relative;
    /* border: 1px solid grey; */
  }
  .bar {
    flex: 1;
    width: 50%;
    background-color: lightsteelblue;
    position: absolute;
    border-radius: 2px;
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  }
  .red {
    background-color: #6699cc;
  }
  .center {
    text-align: center;
    margin: 3rem;
  }
  .container {
    position: relative;
    max-width: 1400px;
    min-width: 400px;
    margin: 3rem;
    margin-top: 1rem;
    /* border: 1px solid grey; */
    aspect-ratio: 1.618/1; /* golden */
  }
</style>
