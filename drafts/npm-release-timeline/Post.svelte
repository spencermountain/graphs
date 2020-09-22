<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import {
    Timeline,
    Column,
    Dash,
    Ticks,
    Line,
    Era,
  } from '/Users/spencer/mountain/somehow-timeline/src'
  import { Text } from '/Users/spencer/mountain/somehow-input/src'
  import getData from './getData'
  import spacetime from 'spacetime'
  import { writable } from 'svelte/store'
  let height = 1500
  let text = writable('wtf_wikipedia')
  let start = 'June 2001'
  let end = 'August 2020'
  let arr = []
  // setTimeout(() => {
  //   arr = [{}, {}]
  // }, 2000)
  const format = function(a) {
    arr = a
    arr = arr.filter(o => {
      return /[a-z]/.test(o.version) === false
    })
    start = arr[0].date //.minus(2, 'months') //.format('iso-short')
    end = arr[arr.length - 1].date //.format('iso-short')

    arr.unshift({
      version: '0.0.0',
      type: 'major',
      date: start,
    })
    arr.unshift({
      version: '0.0.0',
      type: 'minor',
      date: start,
    })
    height = height
    // arr.forEach((obj, i) => {
    //   if (obj.type === 'major') {
    //     let next = arr.slice(i + 1, arr.length).find(o => o.type === 'major') || {}
    //     obj.end = next.date
    //   }
    //   if (obj.type === 'minor') {
    //     let next = arr.slice(i + 1, arr.length).find(o => o.type === 'minor') || {}
    //     obj.end = next.date
    //   }
    // })
    start = spacetime(start).minus(3, 'weeks')
    arr = arr
    console.log(arr)
  }
  getData($text).then(format)
  text.subscribe(str => {
    getData(str).then(format)
  })
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .container {
    max-width: 600px;
  }
</style>

<div>
  <Head num="20" />
  <div class="m3">npm release timeline</div>
  <div class="m3 container">
    <Text bind:text={$text} width="400" delay={1200} />

    <Timeline {start} {end} {height}>
      <Column width="20px">
        <Ticks every="year" />
      </Column>
      <Column width="20px">
        <Ticks every="month" size="8px" color="lightgrey" underline={false} />
      </Column>

      <Column width="50px" label="Major">
        {#each arr as release, i}
          {#if release.type === 'major'}
            <Era start={release.date} end={release.end} label={release.version} opacity="0.5" />
          {/if}
        {/each}
      </Column>

      <Column width="100px" label="Minor" color="purple">
        {#each arr as release}
          {#if release.type === 'minor'}
            <Era start={release.date} end={release.end} opacity="0.4" color="purple" />
          {/if}
        {/each}
      </Column>

      <Column width="100px" label="Patch">
        {#each arr as release}
          {#if release.type === 'patch'}
            <Dash date={release.date} color="blue" opacity="0.5" dotted={false} />
          {/if}
        {/each}
      </Column>

      <!-- <Column width="75px" label="Major">
        {#each arr as release}
          {#if release.type === 'major'}
            <Dash start={release.date} color="purple" opacity="0.5" dotted={false} />
          {/if}
        {/each}
      </Column> -->

    </Timeline>
    <!-- {:catch error}
      <p style="color: red">{error.message}</p>
    {/await} -->
  </div>
  <Foot />
</div>
