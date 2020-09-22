<script>
  import Head from '../../components/Head.svelte'
  import Foot from '../../components/Foot.svelte'
  import { Scale, Thing } from '/Users/spencer/mountain/somehow-scale/src'

  import { Text } from '/Users/spencer/mountain/somehow-input/src'
  import nlp from '/Users/spencer/mountain/compromise/src'
  import nlpNumbers from '/Users/spencer/mountain/compromise/plugins/numbers/src'
  nlp.extend(nlpNumbers)

  export let title = ''
  export let sub = ''
  let a = 'forty seven'
  let b = 'fourteen'
  $: aNum = nlp(a)
    .values()
    .json(0).number
  $: bNum = nlp(b)
    .values()
    .json(0).number
</script>

<style>
  .m3 {
    margin: 3rem;
  }
  .textRow {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    text-align: center;
    flex-wrap: nowrap;
    align-self: stretch;
  }
</style>

<div>
  <Head num="20" />
  <div class="m3">
    <div>percentages:</div>
    <div class="textRow">
      <div class="col">
        <Text bind:text={a} />
        {aNum}
      </div>
      <div class="col">
        <Text bind:text={b} />
        {bNum}
      </div>
    </div>
    <Scale height={800}>
      <Thing color="blue" value={aNum} label={a || 0} />
      <Thing color="green" value={bNum} label={b || 0} />
    </Scale>
  </div>
  <Foot {title} />
</div>
