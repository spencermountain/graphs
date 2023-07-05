<script>
  import { Head, Foot } from '../../components/index.mjs'
  let title = ''
  import spacetime from 'spacetime'
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

  const epoch = (str) => spacetime(str).epoch

  let scale = scaleLinear({
    minmax: [epoch('jan 1 2004'), epoch('jan 1 2024')],
    world: [0, 100],
  })
  console.log(scale)
  const toX = function (str) {
    return scale(epoch(str))
  }
  let data = [
    { start: 'sep 2004', end: 'aug 2008', label: '', color: '#6accb2', layer: 1 }, //university
    {
      start: 'aug 2008',
      end: 'oct 2010',
      above: 'hmm',
      color: '#e6d7b3',
      layer: 1,
      nudge: true,
      height: '12',
    }, //university
    { start: 'oct 2010', end: 'sep 2013', label: 'State.com', color: '#978BA3', layer: 1 }, //state
    { start: 'sep 2013', end: 'sep 2014', label: '', color: '#6accb2', layer: 1 }, //gradschool
    { start: 'oct 10 2014', end: null, label: 'freelancing', color: '#eaa358', layer: 1 },

    { start: 'may 2015', end: 'march 2017', label: 'Govinvest', color: '#6699cc', layer: 2 },
    { start: 'sep 2014', end: 'feb 2015', above: 'KMStandards', color: '#cc7066', layer: 2 },
    { start: 'dec 2015', end: 'apr 2018', label: 'Smallwins', color: '#e6b3bc', layer: 3.2 },
    { start: 'may 2020', end: null, label: 'Fluent', color: '#2D85A8', layer: 3.2 },
    { start: 'jan 2019', end: 'july 2019', above: 'Venngage', color: '#e6d7b3', layer: 3.2 },

    { start: 'july 2019', end: 'feb 2023', label: 'MBI', color: '#978BA3', layer: 2 },
    { start: 'jan 2020', end: 'apr 2020', above: 'Moov', color: '#D68881', layer: 4.3 },
    { start: 'mar 2021', end: 'june 2021', above: 'Newton', color: '#d8b3e6', layer: 4.3 },
  ]

  data.forEach((obj) => {
    obj.left = toX(obj.start)
    obj.width = toX(obj.end) - obj.left
  })

  let labels = [
    { start: 'August 2008', label: 'graduated', y: 1 },
    { start: 'Sep 2013', label: 'grad-school', y: 1 },
    // { start: 'Nov 2015', label: 'nlp-compromise', y: -1 },
  ]
  labels.forEach((obj) => {
    obj.left = toX(obj.start)
  })
  let below = [{ start: 'june 2015', label: 'nlp-compromise', y: -1 }]
  below.forEach((obj) => {
    obj.left = toX(obj.start)
  })
  let axis = [
    { start: 'jan 1 2008', label: '2008', y: 1 },
    { start: 'jan 1 2011', label: '2011', y: 1 },
    { start: 'jan 1 2015', label: '2015', y: 1 },
    { start: 'jan 1 2020', label: '2020', y: 1 },
  ]
  axis.forEach((obj) => {
    obj.left = toX(obj.start)
  })
</script>

<div class="page" style="background-color:#FFFFFF">
  <div class="row" style="height:400px;">
    <div class="full">
      {#each data as o, i}
        <div
          class="bar"
          style="left:{o.left}%; 
          width:{o.width}%; 
          max-height:{o.height || '24'}px; 
          bottom:{o.layer * 40}px; 
          background-color:{o.color};"
        >
          {o.label || ' '}
          {#if o.above}
            <div class="above" class:nudge={o.nudge}>{o.above}</div>
          {/if}
        </div>
      {/each}
      {#each labels as o, i}
        <div class="label" style="left:{o.left}%;  bottom:{o.y * 80}px; ">
          {o.label}
          <div class="line" style="left:{o.left}%;  bottom:{o.y}px; " />
        </div>
      {/each}
      {#each axis as o, i}
        <div class="axis" style="left:{o.left}%;  ">
          {o.label}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .nudge {
    left: 12px !important;
  }
  .bar {
    position: absolute;
    border-radius: 2px;
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
    background-color: steelblue;
    color: #f1f0ef;
    font-size: 11px;
    height: 24px;
  }

  .line {
    position: relative;
    border-left: 1px solid grey;
    width: 2px;
    height: 75px;
    margin-left: 20px;
    padding-bottom: -15px;
    margin-top: 5px;
  }
  .label {
    position: absolute;
    color: grey;
    margin-left: -20px;
    text-align: left;
    width: 10px;
    font-size: 11px;
    white-space: nowrap;
  }
  .above {
    position: absolute;
    color: grey;
    margin-left: 0px;
    text-align: left;
    width: 10px;
    margin-top: -20px;
    margin-left: -7px;
    font-size: 10px;
    font-style: italic;
    white-space: nowrap;
  }
  .axis {
    position: absolute;
    color: grey;
    margin-left: -20px;
    text-align: left;
    width: 10px;
    bottom: 15px;
    font-size: 10px;
    opacity: 0.8;
    white-space: nowrap;
  }
  .full {
    position: relative;
    /* border: 1px solid grey; */
    width: 100%;
    height: 300px;
    margin-top: 4rem;
    margin-bottom: 9rem;
  }
  .row {
    text-align: center;
  }
  :global(body) {
    background-color: #f1f0ef !important;
  }
</style>
