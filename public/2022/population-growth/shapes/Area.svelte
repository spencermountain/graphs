<script>
  import { area, line, curveMonotoneX } from 'd3-shape'
  export let xScale = () => {}
  export let yScale = () => {}
  export let fill = '#50617A'
  export let points = []

  let dFill = area()
    .x(d => xScale(d.x))
    .y0(d => yScale(points[0].y))
    .y1(d => yScale(d.y))
    .curve(curveMonotoneX)(points)
  let dLine = line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(curveMonotoneX)(points)
</script>

<path d={dFill} {fill} stroke="none" stroke-width="0.5%" shape-rendering="geometricPrecision" />
<path
  d={dLine}
  {fill}
  stroke="steelblue"
  stroke-width="1%"
  shape-rendering="geometricPrecision"
  stroke-linecap="butt"
/>
{#each points as p, i}
  <circle fill="steelblue" cx={xScale(p.x)} cy={yScale(p.y)} r="0.5px" />
  <!-- <div class="dot">hi</div> -->
{/each}

<style>
  /* .dot {
    height: 25px;
    width: 25px;
    background-color: green;
    position: absolute;
  } */
</style>
