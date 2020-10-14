<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import data from './data'
  import { Timeline, Axis, Column, Dash, Text } from '/Users/spencer/mountain/somehow-timeline/src'
  export let title = 'Climates of Canadian cities'
  export let sub = ''
  let months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const getColor = function(num) {
    // if (num > 18) {
    //   return 'red'
    // }
    if (num > 15) {
      return 'orange'
    }
    if (num < 0) {
      return 'silver'
    }
    if (num < 10) {
      return 'sky'
    }
    return 'blue'
  }
  let places = Object.keys(data)

  const titleCase = function(str) {
    return str.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    })
  }
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} {sub} num="23" />
  <div class="m3">
    <Timeline start="Dec 10 2019" end="Dec 30 2020" height="700">
      <Axis />
      {#each places as place}
        <Column>
          <Text color="blue" label={titleCase(place)} date="dec 10 2019" underline={true} />
          {#each data[place] as temp, i}
            <Dash date={months[i] + ' 2020'} color={getColor(temp)} height="20px" />
          {/each}
        </Column>
      {/each}

    </Timeline>
  </div>
  <Foot {title} />
</div>
