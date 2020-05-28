<script>
  import { Sankey, Path } from 'somehow-sankey'
  import { Head, Foot } from '../../components/'
  export let title = 'Population of Canada'
  //from Wikipedia by Metro area
  // https://en.wikipedia.org/wiki/Metropolitan_area
  let data = [
    {
      label: 'Toronto',
      value: 5.9,
      city: true,
      color: '#DC788C',
    },
    {
      label: '- Ontario -',
      value: 7.7,
      dim: true,
      color: '#FFE2E8',
    },
    {
      label: 'Montreal',
      value: 4,
      city: true,
      color: '#69D99A',
    },
    {
      label: '- Quebec -',
      value: 2.5,
      dim: true,
      color: '#D1F0DF',
    },
    {
      label: 'Vancouver',
      value: 2.4,
      city: true,
      color: '#D7BDD9',
    },
    {
      label: '- BC -',
      value: 2.2,
      dim: true,
      color: '#FEEFFF',
    },

    {
      label: 'rest of Canada',
      dim: true,
      color: '#dae6f2',
      value: 7.9,
    },
    // {
    //   label: 'Alberta',
    //   value: 4.1,
    // },
    //     {
    //   label: 'Saskatchewan',
    //   value: 1.1,
    // },
    // {
    //   label: 'Manitoba',
    //   value: 1.2,
    // },
    //
    // {
    //   label: 'Newfoundland',
    //   value: 0.5,
    // },
    //   {
    //   label: 'Nova Scotia',
    //   value: 0.9,
    // },
    //  {
    //   label: 'Pei',
    //   value: 0.1,
    // },
  ]
</script>

<style>
  .m3 {
    margin: 3rem;
  }
</style>

<div>
  <Head {title} num="11" />
  <div class="m3">Population of Canada</div>
  <div class="m3">
    <Sankey height={800}>
      <Path source="Toronto" target="Canada" value="6" />
      <Path source="Ontario" target="Canada" value="7.7" />
      <Path source="Montreal" target="Canada" value="4" />
      <Path source="Quebec" target="Canada" value="2.5" />
      <Path source="Vancouver" target="Canada" value="2.4" />
      <Path source="B.C." target="Canada" value="2.2" />
      <Path source="rest" target="Canada" value="7.9" />
    </Sankey>
  </div>

  <Foot {title} />
</div>
