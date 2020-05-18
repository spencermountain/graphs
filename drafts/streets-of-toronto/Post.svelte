<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import Path from './Path.svelte'
  import { ShapeInfo, Intersection } from 'kld-intersections'
  export let title = 'Streets in Toronto'
  export let sub = ''

  import paths from './assets/paths'
  let d = 'M40,70 Q50,150 90,90 T135,130 L160,70 C180,180 280,55 280,140 S400,110 290,100'
  // let start = [15, 75]
  // let end = [355, 140]
  // const path = ShapeInfo.path(d)
  // const line = ShapeInfo.line(start, end)
  // const intersections = Intersection.intersect(path, line)

  // intersections.points.forEach(console.log)
  // let dots = intersections.points
  function enter(e) {
    console.log(e)
  }
  function leave() {}
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .outline {
    border: 1px solid grey;
    border-radius: 5px;
  }
</style>

<div>
  <Head {title} {sub} />
  <div class="m3 outline">
    <svg viewbox="0 0 900 900">
      {#each paths as d}
        <Path {d} />
      {/each}
    </svg>
  </div>
  <Foot {title} />
</div>
