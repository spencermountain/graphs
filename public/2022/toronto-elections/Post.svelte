<script>
  import { Page } from '../../components/index.mjs'
  import names from './colors.js'
  let hover = null
  let clicked = null
  const toggle = function (str) {
    if (clicked === str) {
      clicked = null
      hover = null
    } else {
      clicked = str
    }
  }
  import data from './data.js'
  let colors = {
    'Jennifer Keesmaat': names['pink'],
    'Jack Layton': names['yellow'],
    'Barbara Hall': names['mud'],
    'A. Hummer': names['pink'],
    'George Smitherman': names['fuscia'],
    'Gil Peñalosa': names['royal'],
    'June Rowlands': names['tulip'],
    'John Tory': names['sea'],
    'Doug Ford': names['sky'],
    'Olivia Chow': names['olive'],
    'Art Eggleton': names['suede'],
    'Nathan Phillips': names['sky'],
    'William Dennison': names['greyblue'],
    'Philip Givens': names['tulip'],
    'David Crombie': names['orange'],
    "Tony O'Donohue": names['green'],
    'Allan Lamport': names['red'],
    'Stephen Clarksont': names['fire'],
    'Mel Lastman': names['cherry'],
    'Tooker Gomberg': names['fire'],
    'David Miller': names['brown'],
    'Rob Ford': names['fire'],
    'Doug Ford': names['fire'],
    'Chloe-Marie Brown': names['red'],
    'Joe Pantalone': names['slate'],
    'Carolann Wright': names['green'],
    'Anne Johnston': names['olive'],
    'John Sewell': names['blue'],
    'Don Andrews': names['red'],
    'Margaret Campbell': names['rouge'],
    'Stephen Clarkson': names['beige'],
    'Donald Summerville': names['greygreen'],
    'Arthur J. Brown': names['slate'],
    'Ford Brand': names['olive'],
    'Arthur Brown': names['green'],
    'Leslie Saunders': names['purple'],
    'Roy E. Belyea': names['greygreen'],
    'Ross Dowson': names['orange'],
    'Hiram E. McCallum': names['pink'],
    'Ross Dowson': names['greypurple'],
    'Charles Mahoney': names['rose'],
  }
  export let title = 'Elections in Toronto'
  data.forEach((o, i) => {
    let sum = 0
    o.people.forEach((p) => {
      let num = parseInt(p.percent.replace(/%/, ''))
      sum += num
    })
    o.years = 4
    if (data[i + 1]) {
      o.years = data[i + 1].year - o.year
      if (o.years <= 0) {
        o.years = 1
      }
    }
    o.other = 100 - sum
  })
</script>

<Page {title}>
  {#each data as o, i}
    <!-- <div class="row" style="height:{o.years * 40}px;"> -->
    <div class="row year">
      <div class="digit">{o.year}</div>
      <div class="people">
        {#each o.people as p, i}
          <div
            class="person"
            title={p.name}
            class:shy={(hover && hover !== p.name) || (clicked && clicked !== p.name)}
            style="width:{p.percent}; background-color:{colors[p.name] || 'steelblue'};"
            on:click={() => toggle(p.name)}
            on:mouseenter={() => (hover = p.name)}
            on:mouseleave={() => (hover = null)}
          >
            <!-- {p.name} -->
          </div>
        {/each}
        <div class="person other" style="width:{o.other}%; " />
      </div>
    </div>
  {/each}
</Page>

<style>
  .shy {
    opacity: 0.4;
  }
  .year {
    min-height: 90px;
  }
  .digit {
    width: 80px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    margin-bottom: 1rem;
    color: grey;
  }
  .person {
    height: 75px;
    width: 500px;
    box-shadow: 2px 2px 8px 0px rgba(0, 0, 0, 0.2);
    margin-right: 4px;
    border-radius: 5px;
    transition: opacity 0.25s;
  }
  .person:hover {
    box-shadow: 4px 4px 8px 0px rgba(0, 0, 0, 0.4);
  }
  .other {
    background-color: lightgrey;
  }
  .row {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
  }
  .people {
    width: 400px;
    display: flex;
    flex-direction: row;
    justify-content: stretch;
    align-items: flex-start;
    text-align: left;
    flex-wrap: nowrap;
    align-self: stretch;
  }
  @media only screen and (max-width: 500px) {
    .people {
      width: 300px;
    }
    .person {
      height: 60px;
    }
  }
</style>
