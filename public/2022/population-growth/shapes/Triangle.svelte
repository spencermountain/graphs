<script>
  import { area, line, curveMonotoneX } from 'd3-shape'
  export let xScale = () => {}
  export let yScale = () => {}
  export let fill = 'none'
  export let isFuture = false
  export let points = []
  // let x = xScale(points[points.length - 1].x)

  // add rect
  // let end = xScale('October 24, 2022')
  let last = points[points.length - 1]
  if (!isFuture) {
    points.push({
      y: last.y,
      x: 'October 18, 2022',
    })
  } else {
    points.push({
      y: last.y,
      x: 'December 31, 2030',
    })
  }

  let dFill = area()
    .x(d => {
      return xScale(d.x)
    })
    .y0(d => yScale(points[0].y))
    .y1(d => yScale(d.y))
    .curve(curveMonotoneX)(points)

  // let h = last.y - points[0].y
  // let w = xScale(last.x)
</script>

<path d={dFill} {fill} stroke="none" shape-rendering="geometricPrecision" />
<!-- vertical line -->
<!-- <line
  x1={x}
  y1={yScale(points[0].y)}
  x2={x}
  y2={yScale(points[points.length - 1].y)}
  stroke-width="0.3%"
  stroke="lightgrey"
  stroke-dasharray="1"
/> -->
<!-- horizontal line -->
<!-- <line
  x1={xScale(points[0].x)}
  y1={yScale(points[0].y)}
  x2={x}
  y2={yScale(points[0].y)}
  stroke-width="0.3%"
  stroke="lightgrey"
  stroke-dasharray="1"
/> -->

<!-- <div class="label" style="left:{end}; top:{yScale(points[0].y)}">{label + 'hi'}</div> -->

<!-- <rect x={xScale(last.x) - 0.1} y={yScale(last.y)} height={yScale(h)} width="100" {fill} stroke="none" /> -->
<style>
</style>
