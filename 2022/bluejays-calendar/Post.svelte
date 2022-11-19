<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import { Quarter } from '/Users/spencer/mountain/somehow-calendar/src/index.mjs'
  import games from './data/games'
  let title = 'bluejays calendar'

  let tops = {}
  let bottoms = {}
  let isHome = {}
  games.forEach((g) => {
    if (g.home) {
      isHome[g.date] = true
    }
    if (g.daytime) {
      tops[g.date] = g.home ? 'steelblue' : 'lightsteelblue'
    } else {
      bottoms[g.date] = g.home ? 'steelblue' : 'lightsteelblue'
    }
  })
</script>

<Head {title} num="02" />
<div>
  <div class="m3" style="max-width:1200px;">
    <Quarter date={'2022-04-01'} {tops} {bottoms} {isHome} showToday={false} />
    <Quarter date={'2022-07-01'} {tops} {bottoms} {isHome} showToday={false} />
    <Quarter date={'2022-10-01'} {tops} {bottoms} {isHome} showToday={false} />
  </div>
</div>
<Foot {title} />

<style>
  .m3 {
    margin: 3rem;
  }
</style>
