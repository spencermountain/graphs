<script>
  import { Head, Foot, Num } from '../../components/index.mjs'
  let title = 'Renting vs buying'
  let age = 37
  let rent = 2400
  let house = 1400
  const die = 81

  $: state = {
    age: Number(age),
    rent: Number(rent),
    house: Number(house),
  }
  let year = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  let months = 0
  $: grid = (() => {
    months = Math.ceil((state.house * 1000) / state.rent)
    let years = Math.ceil(months / 12)
    let arr = []
    let left = months
    for (let i = 0; i < years; i += 1) {
      left -= 12
      if (left > 0) {
        arr.push(year.slice(0, left))
      }
    }

    return arr
  })()
</script>

<div class="page">
  <Head {title} sub="" />
  <div class="mid col">
    {months} months ({Math.floor(months / 12)} years)
    <!-- grid -->
    <div class="grid">
      {#each grid as year, i}
        {#if i + state.age === 82}
          <div class="die">--- life expectancy ---</div>
        {/if}
        <div class="year">
          <span class="age">{i + state.age}</span>
          {#each Array(12) as _, i}
            <div class="box" class:full={year[i]} />
          {/each}
        </div>
      {/each}
    </div>
    <!-- numbers -->
    <div class="row">
      <Num bind:text={age} label="age:" />
      <Num bind:text={rent} label="rent:" />
      <Num bind:text={house} label="buy (thousand):" />
    </div>
    <div>{JSON.stringify(state)}</div>
    <Foot {title} year="2023" />
  </div>
</div>

<style>
  .row {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
  }
  .full {
    background-color: lightsteelblue;
  }
  .col {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
    width: 100%;
  }
  .age {
    color: lightgrey;
    font-size: 0.6rem;
    width: 40px;
  }
  .grid {
    width: 100%;
    display: flex;
    display: flex;
    flex-direction: column-reverse;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: wrap;
    align-self: stretch;
    width: 100%;
  }
  .year {
    display: flex;
    flex-grow: 1;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    flex-wrap: nowrap;
    width: 100%;
  }
  .box {
    width: 100%;
    flex: 1;
    max-width: 20px;
    max-height: 20px;
    aspect-ratio: 1 / 1;
    border: 1px dotted lightgrey;
  }
</style>
