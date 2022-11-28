<script>
  import { Page } from '../../components/index.mjs'
  import data from './data.js'
  import spacetime from 'spacetime'
  import scale from './scale.js'

  let title = 'Toronto housing pipeline'
  let start = spacetime('2006-11-13')
  let end = spacetime('2023-01-01')
  let xScale = (str) =>
    scale({ world: [0, 100], minmax: [start.epoch, end.epoch] }, spacetime(String(str)).epoch)

  let rows = data.map((o) => {
    let start = xScale(o.start)
    let issued = xScale(o.issued)
    let done = xScale(o.completed)

    return {
      yellow_start: start,
      yellow_width: issued - start,
      blue_start: issued,
      blue_width: done - issued,
      completed: o.completed,
      units: o.units,
      address: o.address,
      approved_term: '#D68881',
      issued_term: '#8BA3A2',
      done,
    }
  })
  rows = rows.filter((o) => o.units > 4)
  rows = rows.sort((a, b) => {
    if (a.done > b.done) {
      return -1
    } else if (a.done < b.done) {
      return 1
    }
    return 0
  })
</script>

<Page {title} height="1300" width="900">
  <div>
    <div class="above">
      <!-- <div style="margin-top:5rem; margin-left:4rem; margin-bottom:2rem;">Timeline of development:</div> -->
      <div class="row" style="justify-content:center; margin-left:3rem; margin-bottom:3rem;">
        <div class="col" style="width:12px;">
          <div class="label">&nbsp;</div>
          <div
            class="legend approve"
            style="width:12px; border-radius:2px 0px 0px 2px;background-color:#8BA3A2;"
          />
        </div>
        <div class="col">
          <div class="label">Application Process</div>
          <div class="legend wait" style="" />
          <div class="label sublabel" style="left:37%;">submitted</div>
        </div>
        <div class="col" style="width:12px;">
          <div class="label">&nbsp;</div>
          <div
            class="legend approve"
            style="width:12px;border-radius:0px; background-color:#D68881;"
          />
          <div class="label sublabel">issued</div>
        </div>
        <div class="col">
          <div class="label">Building</div>
          <div class="legend build" style="border-radius:0px 2px 2px 0px;" />
        </div>
      </div>
    </div>
    <div class="container col">
      <div class="row" style="justify-content: flex-end; margin-right:20px; top:20px; color:grey;">
        <h4>Multiplexes completed<br /> during this term ↓</h4>
      </div>
      <div style="margin:0.75rem;" />
      {#each rows as o, i}
        <div class="row lines">
          <div class="bar wait" style="left:{o.yellow_start}%; width:{o.yellow_width}%;" />
          <div
            class="bar approve"
            style="left:{o.yellow_start}%; width:{0.65}%; background-color:{o.issued_term};"
          />
          <div
            class="bar build"
            style="left:{o.blue_start}%; width:{o.blue_width}%;"
            title={o.address + o.completed}
          />
          <div
            class="bar approve"
            style="left:{o.blue_start}%; width:{0.5}%; background-color:{o.approved_term};"
          />
        </div>
      {/each}
      <div class="line" style="left:{xScale('2018-10-22')}%" />
      <div class="line" style="left:{xScale('2014-10-27')}%" />
      <div class="line" style="left:{xScale('2010-10-25')}%" />
      <div style="margin:0.75rem;" />
      <!-- <div class="line" style="left:{xScale('2006-11-13')}%" /> -->
    </div>
    <div class="row down bars">
      <div class="term col" style="border-top:3px solid lightgrey;">Miller #2</div>
      <div class="term col" style="border-top:3px solid lightgrey;">Ford</div>
      <div class="term col" style="border-top:3px solid lightgrey;">Tory #1</div>
      <div class="term col" style="border-top:3px solid lightgrey;">Tory #2</div>
    </div>
  </div>
</Page>

<style>
  .down {
    margin: 15%;
    margin-left: 14%;
    margin-bottom: 100px;
    /* border: 1px solid grey; */
    /* margin-left: 22px; */
  }
  .term {
    /* border-radius: 5px; */
    color: grey;
    padding: 0.3rem;
    font-size: 15px;
    line-height: 15px;
    font-weight: 100;
    flex: 1;
    margin: 2px;
    height: 20px;
    display: inline-block;
  }
  .above {
    margin-top: 3rem;
    margin-bottom: 0rem;
  }
  .legend {
    width: 14rem;
    height: 8px;
  }
  .line {
    height: 95%;
    bottom: 1%;
    border-left: 2px dashed darkgrey;
    width: 10px;
    position: absolute;
  }
  .build {
    background-color: #6699cc;
    border-radius: 0px 2px 2px 0px;
  }
  .approve {
    background-color: #8ba3a2;
    border-radius: 2px;
    /* padding-top: 1px; */
    /* padding-bottom: 1px; */
  }
  .wait {
    background-color: lightsteelblue;
    /* border-radius: 3px 0px 0px 3px; */
  }
  .container {
    margin-left: 15%;
    margin-right: 15%;
    position: relative;
    /* border-bottom: 1px solid grey; */
    overflow: clip;
  }
  .row {
    position: relative;
    min-height: 4px;
    margin-top: 1px;
  }
  .lines {
    min-height: 5px;
    /* margin: 2rem; */
  }
  .bar {
    min-height: 6px;
    /* border-radius: 3px; */
    /* padding-top: 5px; */
    position: absolute;
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
  }
  .label {
    color: grey;
    margin-bottom: 0.4rem;
    line-height: 18px;
  }
  .sublabel {
    position: absolute;
    bottom: -29px;
    font-size: 11px;
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
