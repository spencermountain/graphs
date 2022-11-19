<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import scale from './lib/scale.js'
  import spacetime from 'spacetime'
  import XAxis from './xAxis.svelte'
  import YAxis from './yAxis.svelte'
  import Triangle from './shapes/Triangle.svelte'
  import terms from './data/by-mayor.js'
  import combos from './lib/combos.js'

  let combo = combos.yukon
  terms.forEach((o, i) => {
    o.color = combo[i] || o.color
  })

  let max = 3000000
  let min = terms[0].points[0].y
  let start = spacetime(terms[0].points[0].x + '-01-01')
  let end = spacetime('2030-01-01')
  //63 years
  //+1,042,895 people
  // 16k people /year

  let xScale = (str) =>
    scale({ world: [0, 100], minmax: [start.epoch, end.epoch] }, spacetime(String(str)).epoch)
  let yScale = (n) => scale({ world: [0, 100], minmax: [max, min] }, n) // reversed

  let todayX = xScale('October 24, 2022')
  let title = 'Toronto Population growth'
</script>

<Head {title} num="04" />
<div class="col all">
  <div class="container">
    <div class="top-stat">3 million<br />by 2031<br />*</div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
      <!-- <Line {points} {xScale} {yScale} /> -->
      <!-- <Area {future} {xScale} {yScale} fill="lightgrey" /> -->

      {#each terms as term, i}
        <Triangle
          points={term.points}
          {xScale}
          {yScale}
          fill={term.color || 'lightgrey'}
          isFuture={term.future}
        />
      {/each}
      <line
        x1={xScale(2000000)}
        y1={yScale(terms[0].points[0].y)}
        x2={xScale('2030')}
        y2={yScale(3000000)}
        stroke-width="0.5%"
        stroke="grey"
        stroke-dasharray="1"
      />
    </svg>
    <XAxis {xScale} />
    <YAxis {yScale} />
    <div class="today" style="left:{xScale('October 24, 2022') + 0.3}%;" />
    {#each terms as term, i}
      <div class="mayor" style="color:{term.color};  left:{todayX + 2}%; top:{yScale(term.mid)}%;">
        {term.mayor}
      </div>
      <!-- {#if !term.future && i > 0}
        <div
          class="bottom-line"
          style="background-color:{term.color}; margin-left:-15px;
          width:{10}px; 
          left:{xScale(term.points[0].x)}%;"
        />
      {/if} -->
      <!-- <div class="today" style="left:{xScale(term.points[0].x)}%;" /> -->
    {/each}
  </div>
</div>
<Foot {title} />

<style>
  .top-stat {
    font-size: 15px;
    color: grey;
    right: -40px;
    position: absolute;
    top: -55px;
    line-height: 1.2rem;
  }
  .col {
    text-align: center;
    margin-top: 4rem;
  }
  .today {
    height: 80%;
    position: absolute;
    top: 18%;
    border-left: 2px dashed grey;
  }
  .container {
    position: relative;
    /* border: 1px solid grey; */
    /* margin: 3rem; */
    min-width: 600px;
    /* padding-left: 40px; */
    aspect-ratio: 1.618/1; /* golden */
  }
  .mayor {
    position: absolute;
    font-size: 18px;
    color: grey;
  }

  svg {
    overflow: visible;
    position: relative;
  }
  .all {
    margin: 4rem;
  }
</style>
