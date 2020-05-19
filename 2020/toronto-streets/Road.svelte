<script>
  import { getContext } from 'svelte'
  import * as d3Geo from 'd3-geo'
  import * as topojson from 'topojson-client'
  import c from 'spencer-color'
  import { isDown } from './stores.js'

  export let shape = ''
  export let stroke = 'lightgrey'
  export let fill = 'white'
  let hovering
  let selected = false
  fill = c.colors[fill] || fill
  stroke = c.colors[stroke] || stroke

  let projection = getContext('projection')
  const toPath = d3Geo.geoPath().projection(projection)

  let d = toPath(shape)

  function enter() {
    if ($isDown === true) {
      selected = true
    } else {
      hovering = true
    }
  }
  function leave() {
    hovering = false
  }
  function onClick() {
    selected = !selected
  }
</script>

<path
  {d}
  stroke={selected ? '#D68881' : '#bfb0b3'}
  fill="none"
  stroke-linecap={hovering || selected ? 'round' : 'butt'}
  on:mouseenter={enter}
  on:mouseleave={leave}
  on:click={onClick}
  stroke-width={hovering || selected ? '5px' : '2px'} />
