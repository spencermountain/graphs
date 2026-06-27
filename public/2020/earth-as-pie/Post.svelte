<script>
  import { Page } from '../../components/index.mjs'
  import { Round, Arc, Label } from '/Users/spencer/mountain/somehow-circle/src/index.mjs'
  export let title = 'Earth as a pie-chart'
  export let sub = 'at 40° N'
  const rotate = 50
  const lat = 40
  const longToDec = function (arr) {
    arr.forEach((a) => {
      // -180,180 -> 0-360
      a[1] += 180 - rotate
      if (a[2]) {
        a[2] += 180 - rotate
      }
    })
  }

  // at 40deg
  let points = [
    ['New York', -73],
    ['Barcelona', -8.5],
    ['Istanbul', 28],
    ['Tehran', 50],
    ['Beijing', 116],
    ['Seoul', 126],
    ['Tokyo', 138],
    ['Salt Lake City', -112],
    ['Denver', -106],
    ['St Louis', -88],
  ]
  let oceans = [
    ['Atlantic', -69, -9],
    ['Pacific', 144, 236],
  ]
  let continents = [
    ['America', -123, -70],
    ['Eurasia', -8, 143],
  ] //-143
  longToDec(oceans)
  longToDec(continents)
  longToDec(points)
  console.log(oceans)
</script>

<Page {title} {sub} grow={true} max={1000}>
  <Round rotate="0" margin={15}>
    {#each oceans as a}
      <Arc from={a[1]} to={a[2]} color="blue" width="5" label={a[0]} radius="60" />
    {/each}
    {#each continents as a}
      <Arc from={a[1]} to={a[2]} color="orange" width="5" radius="60" />
    {/each}
    <!-- <Circle radius="70" /> -->
    <!-- <Line length="70" angle="90" /> -->
    {#each points as a}
      <Label angle={a[1]} radius="68" text={a[0]} color="grey" align="right" />
    {/each}
  </Round>
</Page>
